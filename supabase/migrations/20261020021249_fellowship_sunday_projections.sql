begin;
create table public.fellowship_sunday_projections (
  service_date date not null check (extract(dow from service_date)=0),
  fellowship text not null check (fellowship in ('All Grace','Parakletos','Special Dunamis','Katalambano','Pleroma','Young and Ready','Shalach','Menorah','Enthroned','Mega','Professionals')),
  projected_member_ids uuid[] not null default '{}',
  revision integer not null default 0 check (revision>=0),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key(service_date,fellowship),
  check(array_position(projected_member_ids,null) is null)
);
alter table public.fellowship_sunday_projections enable row level security;
revoke all on public.fellowship_sunday_projections from public,anon,authenticated;
grant select,insert,update on public.fellowship_sunday_projections to service_role;

create function public.save_fellowship_sunday_projection(p_service_date date,p_fellowship text,p_member_ids uuid[],p_expected_revision integer,p_updated_by text)
returns public.fellowship_sunday_projections language plpgsql security invoker set search_path='' as $$
declare saved public.fellowship_sunday_projections; ids uuid[];
begin
  if p_service_date is null or extract(dow from p_service_date)<>0 then
    raise exception 'Choose a valid Sunday service date';
  end if;
  if p_member_ids is null or array_position(p_member_ids,null) is not null or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Enter valid projected members and revision';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fellowship-projection:'||p_service_date::text||':'||p_fellowship,0));
  select * into saved from public.fellowship_sunday_projections where service_date=p_service_date and fellowship=p_fellowship for update;
  if clock_timestamp() >= ((p_service_date + time '12:00') at time zone 'Africa/Accra') then
    raise exception using errcode='40001',message='Sunday projections are locked from 12 noon Ghana time on the service date.';
  end if;
  if coalesce(saved.revision,0)<>p_expected_revision then
    raise exception using errcode='40001',message='Another leader updated this projection. Refresh before saving again.';
  end if;
  select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into ids from unnest(p_member_ids) id;
  perform 1 from public.members where id=any(ids) and fellowship=p_fellowship and is_active and merged_into_id is null for share;
  if (select count(*) from public.members where id=any(ids) and fellowship=p_fellowship and is_active and merged_into_id is null)<>cardinality(ids) then
    raise exception 'Only active brethren in your fellowship can be projected. Refresh the roster.';
  end if;
  if clock_timestamp() >= ((p_service_date + time '12:00') at time zone 'Africa/Accra') then
    raise exception using errcode='40001',message='Sunday projections are locked from 12 noon Ghana time on the service date.';
  end if;
  insert into public.fellowship_sunday_projections(service_date,fellowship,projected_member_ids,revision,submitted_at,updated_by)
    values(p_service_date,p_fellowship,ids,1,now(),p_updated_by)
    on conflict(service_date,fellowship) do update set projected_member_ids=excluded.projected_member_ids,
      revision=public.fellowship_sunday_projections.revision+1,updated_at=now(),updated_by=p_updated_by,
      submitted_at=coalesce(public.fellowship_sunday_projections.submitted_at,now())
    returning * into saved;
  return saved;
end $$;
revoke all on function public.save_fellowship_sunday_projection(date,text,uuid[],integer,text) from public,anon,authenticated;
grant execute on function public.save_fellowship_sunday_projection(date,text,uuid[],integer,text) to service_role;

commit;
