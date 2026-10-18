-- Disposable database only; no persistent fixture changes.
begin;
do $$
declare
  v_account_id uuid := gen_random_uuid();
  v_second_id uuid := gen_random_uuid();
  v_role_id uuid;
begin
  select id into v_role_id from staff_roles where key='fellowship_leader';
  insert into staff_accounts(id,username,display_name,password_hash,role_id)
    values(v_account_id,'self.' || replace(v_account_id::text,'-',''),'Self','hash',v_role_id);
  if not exists(select 1 from staff_account_contacts c where c.account_id=v_account_id) then raise exception 'New accounts need contact entries'; end if;
  update staff_accounts set email='leader.self@example.com' where id=v_account_id;
  if not exists(select 1 from staff_account_contacts c where c.account_id=v_account_id and c.email='leader.self@example.com') then raise exception 'Managed email did not sync'; end if;
  insert into staff_account_contacts(configured_username,email) values('fixture-base','admin.self@example.com');
  begin
    update staff_accounts set email='admin.self@example.com' where id=v_account_id;
    raise exception 'TEST: Managed account stole configured email';
  exception when unique_violation then null; end;
  begin
    insert into staff_account_contacts(configured_username,email) values('other-fixture','leader.self@example.com');
    raise exception 'TEST: Configured account stole managed email';
  exception when unique_violation then null; end;
  insert into staff_accounts(id,username,display_name,password_hash,role_id,configured_username,email)
    values(v_second_id,'moved.' || replace(v_second_id::text,'-',''),'Moved','hash',v_role_id,'fixture-base','admin.self@example.com');
  if exists(select 1 from staff_account_contacts where configured_username='fixture-base') or
     not exists(select 1 from staff_account_contacts c where c.account_id=v_second_id and c.email='admin.self@example.com') then
    raise exception 'Configured-to-managed conversion did not transfer the email';
  end if;
  if has_table_privilege('anon','public.staff_account_contacts','SELECT') or
     has_table_privilege('authenticated','public.staff_account_contacts','UPDATE') then
    raise exception 'Self-service contacts are exposed outside server authorization';
  end if;
end $$;
rollback;
