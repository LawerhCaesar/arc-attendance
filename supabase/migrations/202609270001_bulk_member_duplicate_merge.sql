-- Merge a reviewed one-to-many duplicate group in one set-based transaction.
-- Populated primary fields are preserved; blank primary fields are filled from
-- any populated secondary value before the secondary records are deactivated.

create or replace function public.merge_legacy_member_group(
  p_primary_id uuid,
  p_secondary_ids uuid[],
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
  v_merged public.members%rowtype;
  v_expected_count integer;
  v_secondary_count integer;
  v_fill_phone text;
  v_fill_fellowship text;
  v_fill_designation text;
  v_fill_birthday text;
  v_fill_location text;
begin
  if p_primary_id is null then
    raise exception 'Primary member is required';
  end if;

  select count(*) into v_expected_count
  from (
    select distinct secondary_id
    from unnest(p_secondary_ids) as secondary_id
    where secondary_id is not null and secondary_id <> p_primary_id
  ) requested;

  if v_expected_count = 0 then
    raise exception 'At least one secondary member is required';
  end if;

  select * into v_primary
  from public.members
  where id = p_primary_id and is_active = true
  for update;
  if not found then raise exception 'Active primary member not found'; end if;

  perform id
  from public.members
  where id = any(p_secondary_ids)
    and id <> p_primary_id
    and is_active = true
  for update;
  get diagnostics v_secondary_count = row_count;

  if v_secondary_count <> v_expected_count then
    raise exception 'Some active secondary members could not be found';
  end if;

  select
    max(nullif(btrim(phone), '')),
    max(nullif(btrim(fellowship), '')) filter (
      where lower(coalesce(nullif(btrim(fellowship), ''), 'unassigned')) <> 'unassigned'
    ),
    max(nullif(btrim(designation), '')),
    max(nullif(btrim(birthday), '')),
    max(nullif(btrim(location), ''))
  into
    v_fill_phone,
    v_fill_fellowship,
    v_fill_designation,
    v_fill_birthday,
    v_fill_location
  from public.members
  where id = any(p_secondary_ids)
    and id <> p_primary_id
    and is_active = true;

  update public.members
  set
    phone = coalesce(nullif(btrim(v_primary.phone), ''), v_fill_phone, ''),
    fellowship = case
      when nullif(btrim(v_primary.fellowship), '') is null or lower(v_primary.fellowship) = 'unassigned'
        then coalesce(v_fill_fellowship, v_primary.fellowship)
      else v_primary.fellowship
    end,
    designation = coalesce(nullif(btrim(v_primary.designation), ''), v_fill_designation, 'Member'),
    birthday = coalesce(nullif(btrim(v_primary.birthday), ''), v_fill_birthday, ''),
    location = coalesce(nullif(btrim(v_primary.location), ''), v_fill_location, ''),
    updated_at = now()
  where id = p_primary_id
  returning * into v_merged;

  update public.attendance attendance_row
  set
    name = v_merged.name,
    phone = v_merged.phone,
    fellowship = v_merged.fellowship,
    designation = v_merged.designation,
    birthday = coalesce(nullif(btrim(attendance_row.birthday), ''), v_merged.birthday),
    location = coalesce(nullif(btrim(attendance_row.location), ''), v_merged.location)
  where exists (
    select 1
    from public.members secondary
    where secondary.id = any(p_secondary_ids)
      and secondary.id <> p_primary_id
      and secondary.is_active = true
      and (
        (
          length(regexp_replace(coalesce(secondary.phone, ''), '\D', '', 'g')) >= 7
          and right(regexp_replace(coalesce(attendance_row.phone, ''), '\D', '', 'g'), 9) =
              right(regexp_replace(secondary.phone, '\D', '', 'g'), 9)
        ) or (
          nullif(btrim(secondary.phone), '') is null
          and lower(btrim(attendance_row.name)) = lower(btrim(secondary.name))
          and lower(btrim(coalesce(attendance_row.fellowship, ''))) =
              lower(btrim(coalesce(secondary.fellowship, '')))
        )
      )
  );

  update public.members
  set is_active = false, updated_at = now()
  where id = any(p_secondary_ids)
    and id <> p_primary_id
    and is_active = true;

  insert into public.member_duplicate_decisions (
    member_a_id,
    member_b_id,
    decision,
    primary_member_id,
    decided_by,
    reason_snapshot,
    merge_snapshot,
    updated_at
  )
  select
    case when p_primary_id::text < secondary.id::text then p_primary_id else secondary.id end,
    case when p_primary_id::text < secondary.id::text then secondary.id else p_primary_id end,
    'merged',
    p_primary_id,
    p_decided_by,
    p_reason_snapshot,
    jsonb_build_object(
      'primary_before', to_jsonb(v_primary),
      'secondary_before', to_jsonb(secondary),
      'primary_after', to_jsonb(v_merged),
      'bulk_group', true
    ),
    now()
  from public.members secondary
  where secondary.id = any(p_secondary_ids)
    and secondary.id <> p_primary_id
  on conflict (member_a_id, member_b_id) do update set
    decision = excluded.decision,
    primary_member_id = excluded.primary_member_id,
    decided_by = excluded.decided_by,
    reason_snapshot = excluded.reason_snapshot,
    merge_snapshot = excluded.merge_snapshot,
    updated_at = now();

  return p_primary_id;
end;
$$;

revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from public;
revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from anon;
revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from authenticated;
grant execute on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) to service_role;
