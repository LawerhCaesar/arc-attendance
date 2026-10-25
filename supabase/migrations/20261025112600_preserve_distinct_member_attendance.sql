-- Merge linked histories as a union; shared phone numbers alone never transfer another member's unlinked attendance.
begin;
create or replace function public.merge_legacy_member_group(
  p_primary_id uuid, p_secondary_ids uuid[], p_decided_by text,
  p_reason_snapshot jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  primary_before public.members%rowtype;
  merged public.members%rowtype;
  secondary_ids uuid[];
  group_ids uuid[];
  attendance_ids uuid[];
  members_snapshot jsonb;
  attendance_snapshot jsonb;
  expected integer;
  locked integer;
  event_id uuid;
begin
  select array_agg(distinct id) into secondary_ids from unnest(p_secondary_ids) id
  where id is not null and id <> p_primary_id;
  expected := coalesce(cardinality(secondary_ids), 0);
  if p_primary_id is null or expected = 0 then raise exception 'A primary and at least one secondary member are required'; end if;

  -- Lock in stable order so simultaneous overlapping reviews cannot cross-merge.
  perform id from public.members where id = p_primary_id or id = any(secondary_ids) order by id for update;
  select * into primary_before from public.members where id = p_primary_id and is_active and merged_into_id is null;
  if not found then raise exception 'Active primary member not found'; end if;
  select count(*) into locked from public.members where id = any(secondary_ids) and merged_into_id is null;
  if locked <> expected then raise exception 'Some secondary members have already changed; refresh the review'; end if;

  select array_agg(id), jsonb_agg(to_jsonb(m)) into group_ids, members_snapshot
  from public.members m where id = p_primary_id or id = any(secondary_ids)
    or merged_into_id = p_primary_id or merged_into_id = any(secondary_ids);

  -- Match both the old primary identity and every alias before changing fields.
  with aliases as materialized (
    select distinct public.member_identity_name(name) name_key,
      app_private.member_phone_key(phone) phone_key,
      lower(trim(coalesce(fellowship,''))) fellowship_key
    from public.members where id = any(group_ids)
  ), legacy as materialized (
    select id, public.member_identity_name(name) name_key,
      app_private.member_phone_key(phone) phone_key,
      lower(trim(coalesce(fellowship,''))) fellowship_key
    from public.attendance where member_id is null
  ), matched as (
    select id from public.attendance where member_id = any(group_ids)
    union
    select a.id from legacy a join aliases m on
      a.name_key <> '' and a.name_key = m.name_key and a.fellowship_key = m.fellowship_key
      and (a.phone_key is null or m.phone_key is null or a.phone_key = m.phone_key)
    where not exists (
      select 1 from public.members other
      where not (other.id = any(group_ids)) and other.merged_into_id is null
        and public.member_identity_name(other.name) = a.name_key
        and lower(trim(coalesce(other.fellowship,''))) = a.fellowship_key
        and (a.phone_key is null or app_private.member_phone_key(other.phone) is null
          or app_private.member_phone_key(other.phone) = a.phone_key)
    )
  ) select array_agg(id) into attendance_ids from matched;
  perform a.id from public.attendance a where a.id = any(attendance_ids) order by a.id for update;
  select array_agg(a.id), coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
  into attendance_ids, attendance_snapshot
  from public.attendance a where a.id = any(attendance_ids);

  insert into public.member_merge_events(primary_member_id, decided_by, members_before, attendance_before)
  values(p_primary_id, p_decided_by, members_snapshot, attendance_snapshot) returning id into event_id;

  update public.members p set
    phone = coalesce(nullif(trim(p.phone), ''), f.phone, ''),
    fellowship = case when lower(trim(coalesce(p.fellowship, ''))) in ('', 'unassigned')
      then coalesce(f.fellowship, p.fellowship) else p.fellowship end,
    designation = coalesce(nullif(trim(p.designation), ''), f.designation, 'Member'),
    birthday = coalesce(nullif(trim(p.birthday), ''), f.birthday, ''),
    location = coalesce(nullif(trim(p.location), ''), f.location, ''),
    updated_at = now()
  from (
    select
      (array_agg(nullif(trim(phone), '') order by array_position(p_secondary_ids, id)) filter(where nullif(trim(phone), '') is not null))[1] phone,
      (array_agg(fellowship order by array_position(p_secondary_ids, id)) filter(where lower(trim(coalesce(fellowship, ''))) not in ('', 'unassigned')))[1] fellowship,
      (array_agg(designation order by array_position(p_secondary_ids, id)) filter(where nullif(trim(designation), '') is not null))[1] designation,
      (array_agg(birthday order by array_position(p_secondary_ids, id)) filter(where nullif(trim(birthday), '') is not null))[1] birthday,
      (array_agg(location order by array_position(p_secondary_ids, id)) filter(where nullif(trim(location), '') is not null))[1] location
    from public.members where id = any(secondary_ids)
  ) f where p.id = p_primary_id returning p.* into merged;

  update public.attendance a set member_id = p_primary_id,
    name = merged.name, phone = merged.phone, fellowship = merged.fellowship, designation = merged.designation,
    birthday = coalesce(nullif(trim(a.birthday), ''), merged.birthday),
    location = coalesce(nullif(trim(a.location), ''), merged.location)
  where a.id = any(attendance_ids);

  -- Every source row survives with its original service/status evidence.
  if exists (
    select 1 from jsonb_array_elements(attendance_snapshot) saved
    left join public.attendance a on a.id = (saved->>'id')::uuid
    where a.id is null or a.member_id is distinct from p_primary_id
      or a.date is distinct from saved->>'date'
      or a."attendanceDate" is distinct from saved->>'attendanceDate'
      or a."attendanceStatus" is distinct from saved->>'attendanceStatus'
      or a."firstTimer" is distinct from saved->>'firstTimer'
  ) then raise exception 'Merge would lose or alter attendance evidence; no changes saved'; end if;

  insert into public.member_duplicate_decisions(member_a_id, member_b_id, decision, primary_member_id,
    decided_by, reason_snapshot, merge_snapshot, updated_at)
  select least(p_primary_id::text, m.id::text)::uuid, greatest(p_primary_id::text, m.id::text)::uuid,
    'merged', p_primary_id, p_decided_by, p_reason_snapshot,
    jsonb_build_object('primary_before', to_jsonb(primary_before), 'secondary_before', to_jsonb(m),
      'primary_after', to_jsonb(merged), 'merge_event_id', event_id, 'attendance_count', coalesce(cardinality(attendance_ids), 0)), now()
  from public.members m where m.id = any(secondary_ids)
  on conflict(member_a_id, member_b_id) do update set decision = excluded.decision,
    primary_member_id = excluded.primary_member_id, decided_by = excluded.decided_by,
    reason_snapshot = excluded.reason_snapshot, merge_snapshot = excluded.merge_snapshot, updated_at = now();

  update public.members set is_active = false, merged_into_id = p_primary_id, updated_at = now()
  where id = any(group_ids) and id <> p_primary_id;
  return p_primary_id;
end;
$$;

revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from public, anon, authenticated;
grant execute on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) to service_role;
commit;
