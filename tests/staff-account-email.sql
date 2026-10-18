-- Disposable database only. All fixtures roll back.
begin;
do $$
declare
  account_id uuid := gen_random_uuid();
  role_id uuid;
  original_version integer;
begin
  select id into role_id from staff_roles where key='fellowship_leader';
  insert into staff_accounts(id,username,display_name,password_hash,role_id,email,fellowship)
    values(account_id,'email.' || replace(account_id::text,'-',''),'Email fixture','hash',role_id,'fixture@example.com','Shalach');
  select session_version into original_version from staff_accounts where id=account_id;
  update staff_accounts set email='new@example.com' where id=account_id;
  if (select session_version from staff_accounts where id=account_id) <> original_version + 1 then
    raise exception 'Email changes must revoke old sessions';
  end if;
  update staff_accounts set email='another@example.com', username='renamed.' || replace(account_id::text,'-','') where id=account_id;
  if (select session_version from staff_accounts where id=account_id) <> original_version + 2 then
    raise exception 'Email and username changes must revoke sessions exactly once';
  end if;
  begin
    insert into staff_accounts(username,display_name,password_hash,role_id,email)
      values('dupe.' || replace(account_id::text,'-',''),'Duplicate','hash',role_id,'another@example.com');
    raise exception 'TEST: Duplicate email was accepted';
  exception when unique_violation then null; end;
  begin
    update staff_accounts set email=' UPPER@Example.com ' where id=account_id;
    raise exception 'TEST: Noncanonical email was accepted';
  exception when check_violation then null; end;
  begin
    update staff_accounts set email='not-an-email' where id=account_id;
    raise exception 'TEST: Invalid email was accepted';
  exception when check_violation then null; end;
  if has_table_privilege('anon','public.staff_accounts','SELECT') or
     has_table_privilege('authenticated','public.notification_deliveries','SELECT') or
     has_table_privilege('anon','public.notification_deliveries','INSERT') then
    raise exception 'Account emails or delivery history are exposed';
  end if;
end $$;
rollback;
