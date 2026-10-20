begin;
alter table public.fellowship_sunday_projections add column projected_guests jsonb not null default '[]'::jsonb
  check (jsonb_typeof(projected_guests)='array');
-- Keep the RPC unambiguous; the optional last argument preserves older clients' guests.
drop function public.save_fellowship_sunday_projection(date,text,uuid[],integer,text);
grant usage on schema app_private to service_role;
grant execute on function app_private.member_phone_key(text) to service_role;
create function public.save_fellowship_sunday_projection(p_service_date date,p_fellowship text,p_member_ids uuid[],p_expected_revision integer,p_updated_by text,p_guests jsonb default null)
returns public.fellowship_sunday_projections language plpgsql security invoker set search_path='' as $$
declare saved public.fellowship_sunday_projections; ids uuid[]; guests jsonb; guest jsonb; phone_key text; conflict_name text;
begin
  if p_service_date is null or extract(dow from p_service_date)<>0 then
    raise exception 'Choose a valid Sunday service date';
  end if;
  if p_member_ids is null or array_position(p_member_ids,null) is not null or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Enter valid projected members and revision';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fellowship-projection:'||p_service_date::text||':'||p_fellowship,0));
  select * into saved from public.fellowship_sunday_projections where service_date=p_service_date and fellowship=p_fellowship for update;
  if clock_timestamp() >= ((p_service_date + time '09:00') at time zone 'Africa/Accra') then
    raise exception using errcode='40001',message='Sunday projections are locked from 9 a.m. Ghana time on the service date.';
  end if;
  if coalesce(saved.revision,0)<>p_expected_revision then
    raise exception using errcode='40001',message='Another leader updated this projection. Refresh before saving again.';
  end if;
  guests := coalesce(p_guests,saved.projected_guests,'[]'::jsonb);
  if jsonb_typeof(guests)<>'array' then raise exception 'Enter a valid first-time visitor list'; end if;
  if jsonb_array_length(guests)>200 then raise exception 'Add up to 200 first-time visitors per projection'; end if;
  for guest in select value from jsonb_array_elements(guests) loop
    if jsonb_typeof(guest)<>'object' or jsonb_typeof(guest->'id') is distinct from 'string'
      or (guest->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(guest->'name') is distinct from 'string' or length(trim(guest->>'name')) not between 1 and 120
      or jsonb_typeof(guest->'phone') is distinct from 'string' or length(guest->>'phone')>32 then
      raise exception 'Enter a name and valid optional phone number for each first-time visitor';
    end if;
    phone_key := app_private.member_phone_key(guest->>'phone');
    if trim(guest->>'phone')<>'' and phone_key is null then raise exception 'Enter a valid first-time visitor phone number'; end if;
    select m.name into conflict_name from public.members m
      where m.fellowship=p_fellowship and m.merged_into_id is null
      and ((phone_key is not null and app_private.member_phone_key(m.phone)=phone_key)
        or (phone_key is null and public.member_identity_name(m.name)=public.member_identity_name(guest->>'name')))
      and not exists(select 1 from jsonb_array_elements(coalesce(saved.projected_guests,'[]')) previous
        where previous->>'id'=guest->>'id' and coalesce(previous->>'phone','')=coalesce(guest->>'phone','')) limit 1;
    if found then raise exception 'This visitor is already in your roster as %. Use the existing record in Member Roster instead.',conflict_name; end if;
  end loop;
  if (select count(distinct lower(value->>'id')) from jsonb_array_elements(guests))<>jsonb_array_length(guests)
    or (select count(distinct coalesce(app_private.member_phone_key(value->>'phone'),'name:'||lower(regexp_replace(trim(value->>'name'),'[[:space:]]+',' ','g')))) from jsonb_array_elements(guests))<>jsonb_array_length(guests) then
    raise exception 'This first-time visitor is already included in the projection';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',lower(value->>'id'),'name',trim(value->>'name'),
    'phone',case when app_private.member_phone_key(value->>'phone') is null then '' else '+'||app_private.member_phone_key(value->>'phone') end)),'[]') into guests from jsonb_array_elements(guests);
  select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into ids from unnest(p_member_ids) id;
  perform 1 from public.members where id=any(ids) and fellowship=p_fellowship and is_active and merged_into_id is null for share;
  if (select count(*) from public.members where id=any(ids) and fellowship=p_fellowship and is_active and merged_into_id is null)<>cardinality(ids) then
    raise exception 'Only active brethren in your fellowship can be projected. Refresh the roster.';
  end if;
  if clock_timestamp() >= ((p_service_date + time '09:00') at time zone 'Africa/Accra') then
    raise exception using errcode='40001',message='Sunday projections are locked from 9 a.m. Ghana time on the service date.';
  end if;
  insert into public.fellowship_sunday_projections(service_date,fellowship,projected_member_ids,projected_guests,revision,submitted_at,updated_by)
    values(p_service_date,p_fellowship,ids,guests,1,now(),p_updated_by)
    on conflict(service_date,fellowship) do update set projected_member_ids=excluded.projected_member_ids,projected_guests=excluded.projected_guests,
      revision=public.fellowship_sunday_projections.revision+1,updated_at=now(),updated_by=p_updated_by,
      submitted_at=coalesce(public.fellowship_sunday_projections.submitted_at,now())
    returning * into saved;
  return saved;
end $$;
revoke all on function public.save_fellowship_sunday_projection(date,text,uuid[],integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_fellowship_sunday_projection(date,text,uuid[],integer,text,jsonb) to service_role;

commit;
