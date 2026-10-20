-- Disposable PostgreSQL only, after applying migrations (including member merges).
begin;
do $$ begin
  if exists(select 1 from (values
    ('0503700378','233503700378'),('503700378','233503700378'),
    ('+233 (0) 50 370 0378','233503700378'),('00233503700378','233503700378'),
    ('233123456','233233123456'),('+44 503700378','44503700378'),
    ('+33 503700378','33503700378'),('050370',null),('phone 0503700378',null),
    ('+23350370037899',null),('',null)
  ) cases(phone,expected) where app_private.member_phone_key(phone) is distinct from expected) then
    raise exception 'TEST: SQL phone normalization differs from review matching';
  end if;
end $$;
set local role service_role;
do $$
declare first_id uuid; second_id uuid; legacy_a uuid; legacy_b uuid;
begin
  insert into public.members(name,phone,fellowship) values('Phone guard A','0601234567','Shalach') returning id into first_id;
  set constraints members_active_phone_unique immediate;
  update public.members set name='Phone guard A edited' where id=first_id;
  begin
    insert into public.members(name,phone,fellowship) values('Phone guard B','+233601234567','Pleroma');
    raise exception 'TEST: equivalent phone accepted';
  exception when unique_violation then null; end;
  insert into public.members(name,phone,fellowship) values('Phone guard B','0601234568','Shalach') returning id into second_id;
  begin
    update public.members set phone='601234567',name='Must not save' where id=second_id;
    raise exception 'TEST: edit to occupied phone accepted';
  exception when unique_violation then null; end;
  if (select name from public.members where id=second_id)<>'Phone guard B' then raise exception 'TEST: failed edit changed record'; end if;
  begin
    insert into public.members(name,phone,fellowship) values
      ('Phone import A','0601234570','Shalach'),('Phone import B','00233601234570','Shalach');
    raise exception 'TEST: duplicate import accepted';
  exception when unique_violation then null; end;
  if exists(select 1 from public.members where name like 'Phone import%') then raise exception 'TEST: partial import saved'; end if;
  insert into public.members(name,phone,fellowship) values('No phone A','','Shalach'),('No phone B','','Shalach');
  update public.members set is_active=false where id=first_id;
  insert into public.members(name,phone,fellowship) values('Phone replacement','0601234567','Shalach');
  begin
    update public.members set is_active=true where id=first_id;
    raise exception 'TEST: duplicate reactivation accepted';
  exception when unique_violation then null; end;
  update public.members set phone='0601234571' where id=second_id;
  insert into public.members(name,phone,fellowship) values('Freed phone','0601234568','Shalach');
  -- The merge updates the primary before deactivating secondaries. Commit-time
  -- validation must accept the final unique state, rather than break the merge.
  set constraints members_active_phone_unique deferred;
  insert into public.members(name,phone,fellowship) values('Legacy phone A','0601234580','Shalach') returning id into legacy_a;
  insert into public.members(name,phone,fellowship) values('Legacy phone B','+233601234580','Shalach') returning id into legacy_b;
  perform public.merge_legacy_member_group(legacy_a,array[legacy_b],'phone-guard-test');
  set constraints members_active_phone_unique immediate;
  if (select is_active from public.members where id=legacy_b) then raise exception 'TEST: merge did not retire secondary'; end if;
  if has_schema_privilege('anon','app_private','usage') or has_schema_privilege('authenticated','app_private','usage') then
    raise exception 'TEST: phone registry exposed to clients';
  end if;
end $$;
rollback;
