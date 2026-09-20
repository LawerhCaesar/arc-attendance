-- Human-reviewed duplicate decisions for the legacy member roster.
-- Merge operations are soft and transactional: the secondary member is made
-- inactive while both original records are retained in the decision snapshot.

create table if not exists public.member_duplicate_decisions (
  id uuid primary key default gen_random_uuid(),
  member_a_id uuid not null references public.members(id),
  member_b_id uuid not null references public.members(id),
  decision text not null check (decision in ('keep_separate', 'merged')),
  primary_member_id uuid references public.members(id),
  decided_by text not null,
  reason_snapshot jsonb not null default '{}'::jsonb,
  merge_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_a_id::text < member_b_id::text),
  unique (member_a_id, member_b_id)
);

alter table public.member_duplicate_decisions enable row level security;

create or replace function public.merge_legacy_members(
  p_primary_id uuid,
  p_secondary_id uuid,
  p_decided_by text,
  p_reason_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary public.members%rowtype;
  v_secondary public.members%rowtype;
  v_merged public.members%rowtype;
  v_member_a_id uuid;
  v_member_b_id uuid;
  v_attendance_snapshot jsonb;
begin
  if p_primary_id = p_secondary_id then
    raise exception 'Primary and secondary member must be different';
  end if;

  select * into v_primary
  from public.members
  where id = p_primary_id and is_active = true
  for update;
  if not found then raise exception 'Active primary member not found'; end if;

  select * into v_secondary
  from public.members
  where id = p_secondary_id and is_active = true
  for update;
  if not found then raise exception 'Active secondary member not found'; end if;

  if p_primary_id::text < p_secondary_id::text then
    v_member_a_id := p_primary_id;
    v_member_b_id := p_secondary_id;
  else
    v_member_a_id := p_secondary_id;
    v_member_b_id := p_primary_id;
  end if;

  update public.members
  set
    phone = coalesce(nullif(btrim(v_primary.phone), ''), v_secondary.phone, ''),
    fellowship = case
      when nullif(btrim(v_primary.fellowship), '') is null or lower(v_primary.fellowship) = 'unassigned'
        then coalesce(nullif(btrim(v_secondary.fellowship), ''), v_primary.fellowship)
      else v_primary.fellowship
    end,
    designation = coalesce(nullif(btrim(v_primary.designation), ''), v_secondary.designation, 'Member'),
    birthday = coalesce(nullif(btrim(v_primary.birthday), ''), v_secondary.birthday, ''),
    location = coalesce(nullif(btrim(v_primary.location), ''), v_secondary.location, ''),
    updated_at = now()
  where id = p_primary_id
  returning * into v_merged;

  select coalesce(jsonb_agg(to_jsonb(attendance_row)), '[]'::jsonb)
  into v_attendance_snapshot
  from public.attendance attendance_row
  where (
    length(regexp_replace(coalesce(v_secondary.phone, ''), '\D', '', 'g')) >= 7
    and right(regexp_replace(coalesce(attendance_row.phone, ''), '\D', '', 'g'), 9) =
        right(regexp_replace(v_secondary.phone, '\D', '', 'g'), 9)
  ) or (
    nullif(btrim(v_secondary.phone), '') is null
    and lower(btrim(attendance_row.name)) = lower(btrim(v_secondary.name))
    and lower(btrim(coalesce(attendance_row.fellowship, ''))) = lower(btrim(coalesce(v_secondary.fellowship, '')))
  );

  update public.attendance
  set
    name = v_merged.name,
    phone = v_merged.phone,
    fellowship = v_merged.fellowship,
    designation = v_merged.designation,
    birthday = coalesce(nullif(btrim(birthday), ''), v_merged.birthday),
    location = coalesce(nullif(btrim(location), ''), v_merged.location)
  where (
    length(regexp_replace(coalesce(v_secondary.phone, ''), '\D', '', 'g')) >= 7
    and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) =
        right(regexp_replace(v_secondary.phone, '\D', '', 'g'), 9)
  ) or (
    nullif(btrim(v_secondary.phone), '') is null
    and lower(btrim(name)) = lower(btrim(v_secondary.name))
    and lower(btrim(coalesce(fellowship, ''))) = lower(btrim(coalesce(v_secondary.fellowship, '')))
  );

  update public.members
  set is_active = false, updated_at = now()
  where id = p_secondary_id;

  insert into public.member_duplicate_decisions (
    member_a_id, member_b_id, decision, primary_member_id, decided_by,
    reason_snapshot, merge_snapshot, updated_at
  ) values (
    v_member_a_id, v_member_b_id, 'merged', p_primary_id, p_decided_by,
    p_reason_snapshot,
    jsonb_build_object(
      'primary_before', to_jsonb(v_primary),
      'secondary_before', to_jsonb(v_secondary),
      'attendance_before', v_attendance_snapshot
    ),
    now()
  )
  on conflict (member_a_id, member_b_id) do update set
    decision = excluded.decision,
    primary_member_id = excluded.primary_member_id,
    decided_by = excluded.decided_by,
    reason_snapshot = excluded.reason_snapshot,
    merge_snapshot = excluded.merge_snapshot,
    updated_at = excluded.updated_at;

  return p_primary_id;
end;
$$;

revoke all on function public.merge_legacy_members(uuid, uuid, text, jsonb) from public;
revoke all on function public.merge_legacy_members(uuid, uuid, text, jsonb) from anon;
revoke all on function public.merge_legacy_members(uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.merge_legacy_members(uuid, uuid, text, jsonb) to service_role;
