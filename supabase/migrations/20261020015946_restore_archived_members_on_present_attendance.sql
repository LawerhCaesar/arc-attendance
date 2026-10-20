-- Attendance and restoration commit together. Existing attendance is not
-- backfilled: only a new present insert/update can restore an archived member.
begin;
create function app_private.restore_member_on_present_attendance() returns trigger
language plpgsql security definer set search_path='' as $$
declare service_date date;
begin
  if NEW.member_id is null or coalesce(NEW."attendanceStatus",'') not in ('','present') then return null; end if;
  begin
    service_date := coalesce(nullif(NEW."attendanceDate",''),NEW.date)::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    return null;
  end;
  if service_date is null or service_date > (now() at time zone 'Africa/Accra')::date then return null; end if;
  update public.members set is_active=true, updated_at=now(),
    phone=case when nullif(btrim(phone),'') is null then coalesce(NEW.phone,'') else phone end
    where id=NEW.member_id and fellowship=NEW.fellowship
      and not is_active and merged_into_id is null;
  return null;
end $$;
revoke all on function app_private.restore_member_on_present_attendance() from public, anon, authenticated;
create trigger restore_member_on_present_attendance
after insert or update of member_id, "attendanceStatus", "attendanceDate", fellowship on public.attendance
for each row execute function app_private.restore_member_on_present_attendance();
commit;
