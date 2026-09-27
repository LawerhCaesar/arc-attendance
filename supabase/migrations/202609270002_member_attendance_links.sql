-- Preserve attendance identity through every merge. Stored attendance rows,
-- service dates and statuses are retained, including conflicting duplicates.
begin;

alter table public.members add column if not exists merged_into_id uuid references public.members(id);
alter table public.attendance add column if not exists member_id uuid references public.members(id);
create index if not exists attendance_member_service_idx on public.attendance(member_id, "attendanceDate");
create index if not exists members_merged_into_idx on public.members(merged_into_id);

create table if not exists public.member_merge_events (
  id uuid primary key default gen_random_uuid(),
  primary_member_id uuid not null references public.members(id),
  decided_by text not null,
  members_before jsonb not null,
  attendance_before jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.member_merge_events enable row level security;
revoke all on public.member_merge_events from anon, authenticated;
grant all on public.member_merge_events to service_role;

create or replace function public.member_identity_name(value text)
returns text language sql immutable set search_path = public as $$
  select coalesce(string_agg(token, ' ' order by token), '')
  from regexp_split_to_table(lower(trim(coalesce(value, ''))), '\s+') token;
$$;

-- Recover links for explicitly reviewed earlier merges only.
update public.members m
set merged_into_id = d.primary_member_id
from public.member_duplicate_decisions d
where d.decision = 'merged' and d.primary_member_id is not null
  and m.id = case when d.member_a_id = d.primary_member_id then d.member_b_id else d.member_a_id end
  and m.id <> d.primary_member_id and not m.is_active and m.merged_into_id is null;

-- Flatten previous merge chains to their surviving record.
do $$
declare affected integer;
begin
  loop
    update public.members child set merged_into_id = parent.merged_into_id
    from public.members parent
    where child.merged_into_id = parent.id and parent.merged_into_id is not null
      and child.id <> parent.merged_into_id;
    get diagnostics affected = row_count;
    exit when affected = 0;
  end loop;
end;
$$;

-- Snapshot the historical attendance before repairing any existing links.
create temporary table attendance_merge_repair on commit drop as
with reviewed_aliases as materialized (
  select coalesce(m.merged_into_id,m.id) owner_id, m.name, m.phone, m.fellowship
  from public.members m where m.merged_into_id is not null or m.id in (
    select child.merged_into_id from public.members child where child.merged_into_id is not null
  )
  union all
  select coalesce(p.merged_into_id,p.id), snapshot->>'name', snapshot->>'phone', snapshot->>'fellowship'
  from public.member_duplicate_decisions d join public.members p on p.id = d.primary_member_id
  cross join lateral (values(d.merge_snapshot->'primary_before'),(d.merge_snapshot->'secondary_before')) saved(snapshot)
  where d.decision = 'merged' and snapshot is not null
), merged_members as materialized (
  select distinct m.owner_id,
    public.member_identity_name(m.name) name_key,
    right(regexp_replace(coalesce(m.phone,''), '\D', '', 'g'),9) phone_key,
    lower(trim(coalesce(m.fellowship,''))) fellowship_key
  from reviewed_aliases m
), legacy_attendance as materialized (
  select id, public.member_identity_name(name) name_key,
    right(regexp_replace(coalesce(phone,''), '\D', '', 'g'),9) phone_key,
    lower(trim(coalesce(fellowship,''))) fellowship_key
  from public.attendance where member_id is null
), owners as (
  select a.id, eligible.owner_id
  from legacy_attendance a cross join merged_members eligible
  where (length(eligible.phone_key) >= 7 and a.phone_key = eligible.phone_key)
    or (a.name_key <> '' and a.name_key = eligible.name_key and a.fellowship_key = eligible.fellowship_key)
)
select id, min(owner_id::text)::uuid owner_id from owners group by id having count(distinct owner_id) = 1;

insert into public.member_merge_events(primary_member_id, decided_by, members_before, attendance_before)
select p.id, 'migration:attendance-link-repair',
  (select jsonb_agg(to_jsonb(m)) from public.members m where m.id = p.id or m.merged_into_id = p.id),
  coalesce((select jsonb_agg(to_jsonb(a)) from public.attendance a
    join attendance_merge_repair r on r.id = a.id where r.owner_id = p.id), '[]'::jsonb)
from public.members p where p.is_active and exists (select 1 from public.members m where m.merged_into_id = p.id);

-- A historical row is assigned only when its possible merged owners agree.
update public.attendance a
set member_id = p.id, name = p.name, phone = p.phone, fellowship = p.fellowship, designation = p.designation,
    birthday = coalesce(nullif(trim(a.birthday), ''), p.birthday),
    location = coalesce(nullif(trim(a.location), ''), p.location)
from attendance_merge_repair r join public.members p on p.id = r.owner_id and p.is_active
where a.id = r.id;

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
  select * into primary_before from public.members where id = p_primary_id and is_active;
  if not found then raise exception 'Active primary member not found'; end if;
  select count(*) into locked from public.members where id = any(secondary_ids) and is_active;
  if locked <> expected then raise exception 'Some secondary members have already changed; refresh the review'; end if;

  select array_agg(id), jsonb_agg(to_jsonb(m)) into group_ids, members_snapshot
  from public.members m where id = p_primary_id or id = any(secondary_ids)
    or merged_into_id = p_primary_id or merged_into_id = any(secondary_ids);

  -- Match both the old primary identity and every alias before changing fields.
  with aliases as materialized (
    select distinct public.member_identity_name(name) name_key,
      right(regexp_replace(coalesce(phone,''), '\D', '', 'g'),9) phone_key,
      lower(trim(coalesce(fellowship,''))) fellowship_key
    from public.members where id = any(group_ids)
  ), legacy as materialized (
    select id, public.member_identity_name(name) name_key,
      right(regexp_replace(coalesce(phone,''), '\D', '', 'g'),9) phone_key,
      lower(trim(coalesce(fellowship,''))) fellowship_key
    from public.attendance where member_id is null
  ), matched as (
    select id from public.attendance where member_id = any(group_ids)
    union
    select a.id from legacy a join aliases m on
      (length(m.phone_key) >= 7 and a.phone_key = m.phone_key) or
      (a.name_key <> '' and a.name_key = m.name_key and a.fellowship_key = m.fellowship_key)
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

-- The older two-record entry point must use the same attendance-preserving merge.
create or replace function public.merge_legacy_members(p_primary_id uuid, p_secondary_id uuid,
  p_decided_by text, p_reason_snapshot jsonb default '{}'::jsonb)
returns uuid language sql security definer set search_path = public as $$
  select public.merge_legacy_member_group(p_primary_id, array[p_secondary_id], p_decided_by, p_reason_snapshot);
$$;

revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from public, anon, authenticated;
revoke all on function public.merge_legacy_members(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) to service_role;
grant execute on function public.merge_legacy_members(uuid, uuid, text, jsonb) to service_role;
commit;
