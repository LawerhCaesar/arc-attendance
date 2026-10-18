-- Run only against a disposable database after applying the migrations.
begin;
set local role service_role;
do $$
declare account_id uuid; configured_id uuid; role_id uuid; profile_task_id uuid;
begin
  select id into role_id from public.staff_roles where key='pastor';
  insert into public.staff_accounts(username,display_name,password_hash,role_id)
    values('profile.test.old','Profile Test','fixture-hash',role_id) returning id into account_id;
  insert into public.pastoral_followups(person_ref,name,category,reason,owner,due_date,created_by,updated_by)
    values('profile:test:managed','Synthetic Member','absence','Synthetic reason','profile.test.old',current_date,'test','test')
    returning id into profile_task_id;
  update public.staff_accounts set username='profile.test.new' where id=account_id;
  if (select owner from public.pastoral_followups where id=profile_task_id) <> 'profile.test.new' then
    raise exception 'Managed rename lost ownership';
  end if;
  if not exists(select 1 from public.pastoral_followup_audit where task_id=profile_task_id and owner='profile.test.old') then
    raise exception 'Historical owner was not preserved';
  end if;
  insert into public.pastoral_followups(person_ref,name,category,reason,owner,due_date,created_by,updated_by)
    values('profile:test:configured','Synthetic Member','absence','Synthetic reason','Profile.Configured',current_date,'test','test');
  insert into public.staff_accounts(username,configured_username,display_name,password_hash,role_id)
    values('profile.configured.new','profile.configured','Configured Test','fixture-hash',role_id) returning id into configured_id;
  if not exists(select 1 from public.pastoral_followups where person_ref='profile:test:configured' and owner='profile.configured.new') then
    raise exception 'Configured conversion lost ownership';
  end if;
  update public.staff_accounts set username='profile.configured.again' where id=configured_id;
  if not exists(select 1 from public.pastoral_followups where person_ref='profile:test:configured' and owner='profile.configured.again') then
    raise exception 'Subsequent configured rename lost ownership';
  end if;
  insert into public.pastoral_followups(person_ref,name,category,reason,owner,due_date,created_by,updated_by)
    values('profile:test:case','Synthetic Member','absence','Synthetic reason','Profile.Case',current_date,'test','test');
  insert into public.staff_accounts(username,configured_username,display_name,password_hash,role_id)
    values('profile.case','profile.case','Case Test','fixture-hash',role_id);
  if not exists(select 1 from public.pastoral_followups where person_ref='profile:test:case' and owner='profile.case') then
    raise exception 'Email-only conversion failed to normalize ownership';
  end if;
  if has_function_privilege('anon','public.preserve_staff_followup_ownership()','execute') then
    raise exception 'Trigger function unexpectedly exposed';
  end if;
end $$;
rollback;
