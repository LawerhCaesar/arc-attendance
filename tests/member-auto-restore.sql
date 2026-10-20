-- Run only against a disposable database with the attendance restoration migration.
begin;
do $$
declare
  archived_id uuid := gen_random_uuid(); owner_id uuid := gen_random_uuid();
  merged_id uuid := gen_random_uuid(); blank_id uuid := gen_random_uuid();
  service text := (current_date - extract(dow from current_date)::int)::text;
  attendance_id uuid; failed boolean := false;
begin
  insert into public.members(id,name,phone,fellowship,is_active) values
    (archived_id,'Restore Test Archived','0209100001','Shalach',false),
    (owner_id,'Restore Test Owner','0209100002','Shalach',true),
    (blank_id,'Restore Test Blank','','Shalach',false);
  insert into public.members(id,name,phone,fellowship,is_active,merged_into_id)
    values(merged_id,'Restore Test Merged','','Shalach',false,owner_id);
  insert into public.attendance(member_id,name,phone,fellowship,date,"attendanceDate","attendanceStatus")
    values(archived_id,'Restore Test Archived','0209100001','Shalach',current_date::text,service,'absent') returning id into attendance_id;
  assert not (select is_active from public.members where id=archived_id), 'Absent must remain archived';
  update public.attendance set "attendanceStatus"='present' where id=attendance_id;
  assert (select is_active from public.members where id=archived_id), 'Present correction must restore the same member';
  update public.members set is_active=false where id=archived_id;
  insert into public.attendance(member_id,name,phone,fellowship,date,"attendanceDate","attendanceStatus") values
    (archived_id,'Restore Test Archived','0209100001','Shalach',current_date::text,(current_date+7)::text,'present');
  assert not (select is_active from public.members where id=archived_id), 'Future service must not restore';
  insert into public.attendance(member_id,name,phone,fellowship,date,"attendanceDate","attendanceStatus") values
    (archived_id,'Restore Test Archived','0209100001','Pleroma',current_date::text,service,'present'),
    (merged_id,'Restore Test Merged','','Shalach',current_date::text,service,'present');
  assert not (select is_active from public.members where id=archived_id), 'Wrong fellowship must not restore';
  assert not (select is_active from public.members where id=merged_id), 'Merged records must never return';
  insert into public.attendance(member_id,name,phone,fellowship,date,"attendanceDate","attendanceStatus") values
    (archived_id,'Restore Test Archived','0209100001','Shalach',current_date::text,service,'');
  assert (select is_active from public.members where id=archived_id), 'Legacy blank status counts as present';
  begin
    insert into public.attendance(member_id,name,phone,fellowship,date,"attendanceDate","attendanceStatus") values
      (blank_id,'Restore Test Blank','0209100002','Shalach',current_date::text,service,'present');
    set constraints all immediate;
  exception when unique_violation then failed := true;
  end;
  assert failed, 'Restore must reject a conflicting phone number';
  assert not (select is_active from public.members where id=blank_id), 'Failed restore must stay archived';
  assert not exists(select 1 from public.attendance where member_id=blank_id), 'Failed restoration must roll back attendance too';
  assert not has_function_privilege('anon','app_private.restore_member_on_present_attendance()','EXECUTE'), 'No public RPC execution';
end $$;
rollback;
