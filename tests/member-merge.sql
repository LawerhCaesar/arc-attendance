-- Run inside a transaction and ROLLBACK after this script. Synthetic fixtures
-- exercise the real merge functions without changing any production members.
do $$
declare
  p uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  next_primary uuid := gen_random_uuid();
  tag text := 'merge-test-' || gen_random_uuid()::text;
  ids uuid[];
  before_rows jsonb;
  after_rows jsonb;
  result public.members%rowtype;
  bulk_primary uuid := gen_random_uuid();
  bulk_ids uuid[];
begin
  insert into members(id, name, phone, fellowship, birthday, location) values
    (p, tag || ' Primary', '', tag, '', ''),
    (s, tag || ' Secondary', '0240000198', tag, '12-10', 'Accra'),
    (s2, tag || ' Third', '', tag, '', ''),
    (next_primary, tag || ' Next', '', tag, '', '');

  with inserted as (
    insert into attendance(name, phone, fellowship, date, "attendanceDate", "attendanceStatus", "firstTimer", member_id, location, birthday) values
      (tag || ' Primary', '', tag, '2026-08-01', '2026-08-02', 'absent', 'No', null, '', ''),
      (tag || ' Secondary', '+233240000198', tag, '2026-08-01', '2026-08-02', 'present', 'Yes', null, '', ''),
      (tag || ' Secondary', '', tag, '2026-08-08', '2026-08-09', 'present', 'No', null, '', ''),
      ('Different old spelling', '', tag, '2026-08-15', '2026-08-16', 'absent', 'No', s2, '', '')
    returning id
  ) select array_agg(id) into ids from inserted;
  select jsonb_agg(jsonb_build_array(id,date,"attendanceDate","attendanceStatus","firstTimer") order by id)
    into before_rows from attendance where id = any(ids);

  perform merge_legacy_member_group(p, array[s,s2], 'transaction-test');
  if (select count(*) from attendance where id = any(ids) and member_id = p) <> 4 then
    raise exception 'Merge did not attach every history row (including primary, missing phone, and prelinked)';
  end if;
  select * into result from members where id = p;
  if result.phone <> '0240000198' or result.birthday <> '12-10' or result.location <> 'Accra' then
    raise exception 'Blank fields were not filled';
  end if;
  if result.name <> tag || ' Primary' then raise exception 'Primary name was overwritten'; end if;
  if not exists (select 1 from member_duplicate_decisions where primary_member_id = p
    and (merge_snapshot->'secondary_before'->>'is_active')::boolean = true) then
    raise exception 'Pre-merge audit snapshot was not preserved';
  end if;

  perform merge_legacy_members(next_primary, p, 'transaction-test');
  if (select count(*) from attendance where id = any(ids) and member_id = next_primary) <> 4 then
    raise exception 'Chained merge lost history';
  end if;
  if (select count(*) from members where id = any(array[p,s,s2]) and merged_into_id = next_primary) <> 3 then
    raise exception 'Chained merge lost aliases';
  end if;
  select jsonb_agg(jsonb_build_array(id,date,"attendanceDate","attendanceStatus","firstTimer") order by id)
    into after_rows from attendance where id = any(ids);
  if before_rows <> after_rows then raise exception 'Merge deleted history or changed service/status evidence'; end if;

  begin
    perform merge_legacy_member_group(next_primary, array[s,gen_random_uuid()], 'transaction-test');
    raise exception 'TEST: stale merge unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'TEST: stale merge unexpectedly succeeded' then raise; end if;
  end;

  insert into members(id,name,fellowship) values(bulk_primary, tag || ' Bulk',tag);
  with inserted as (
    insert into members(name,fellowship) select tag || ' Bulk',tag from generate_series(1,990) returning id
  ) select array_agg(id) into bulk_ids from inserted;
  perform merge_legacy_member_group(bulk_primary,bulk_ids,'transaction-test');
  if (select count(*) from members where id = any(bulk_ids) and merged_into_id = bulk_primary and not is_active) <> 990 then
    raise exception 'Large group merge incomplete';
  end if;
  if has_function_privilege('anon','public.merge_legacy_member_group(uuid,uuid[],text,jsonb)','execute') then
    raise exception 'Anonymous callers must not be able to merge members';
  end if;
end;
$$;
