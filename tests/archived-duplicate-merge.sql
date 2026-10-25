-- Disposable database only. Every fixture and merge is rolled back.
begin;
do $$
declare
  primary_id uuid := gen_random_uuid();
  archived_id uuid := gen_random_uuid();
  active_id uuid := gen_random_uuid();
  before_history jsonb;
  after_history jsonb;
begin
  insert into members(id,name,fellowship,birthday,location,is_active) values
    (primary_id,'Synthetic Michael','Synthetic fellowship','17-05','Test location',true),
    (archived_id,'Synthetic Michael','Synthetic fellowship','17-05','Test location',false),
    (active_id,'Synthetic Michael','Synthetic fellowship','17-05','Test location',true);
  insert into attendance(member_id,name,"attendanceDate","attendanceStatus") values
    (archived_id,'Synthetic Michael','2026-08-09','present'),
    (active_id,'Synthetic Michael','2026-08-16','absent');
  select jsonb_agg(jsonb_build_array(id,"attendanceDate","attendanceStatus") order by id)
  into before_history from attendance where member_id in (archived_id,active_id);
  perform merge_legacy_member_group(primary_id,array[archived_id,active_id],'synthetic-review');
  if (select count(*) from members where id in (archived_id,active_id) and not is_active and merged_into_id=primary_id) <> 2 then
    raise exception 'Archived and active aliases were not consolidated';
  end if;
  select jsonb_agg(jsonb_build_array(id,"attendanceDate","attendanceStatus") order by id)
  into after_history from attendance where member_id=primary_id;
  if before_history is distinct from after_history then raise exception 'Attendance evidence changed or was lost'; end if;
  if not exists(select 1 from member_merge_events where primary_member_id=primary_id
    and exists(select 1 from jsonb_array_elements(members_before) saved where saved->>'id'=archived_id::text and saved->>'is_active'='false')) then
    raise exception 'Original archive state missing from merge audit';
  end if;
  begin
    perform merge_legacy_member_group(archived_id,array[primary_id],'must-fail');
    raise exception 'TEST: inactive primary accepted';
  exception when raise_exception then
    if sqlerrm='TEST: inactive primary accepted' then raise; end if;
  end;
end $$;
rollback;
