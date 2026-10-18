-- Run after the role-account migration in a disposable database.
begin;
do $$
declare
  role_id uuid;
  account_id uuid := gen_random_uuid();
  original_version integer;
  tag text := 'account-test-' || gen_random_uuid()::text;
begin
  insert into staff_roles(key,name,permissions) values(tag,tag,array['care']) returning id into role_id;
  insert into staff_accounts(id,username,display_name,password_hash,role_id,configured_username)
    values(account_id,'test.' || replace(account_id::text,'-',''),'Test','hash',role_id,tag);
  select session_version into original_version from staff_accounts where id=account_id;
  update staff_accounts set username='renamed.' || replace(account_id::text,'-','') where id=account_id;
  if (select session_version from staff_accounts where id=account_id) <> original_version + 1 then
    raise exception 'Username change did not revoke old sessions';
  end if;
  update staff_accounts set password_hash='new hash' where id=account_id;
  if (select session_version from staff_accounts where id=account_id) <> original_version + 2 then
    raise exception 'Password reset did not revoke old sessions';
  end if;
  update staff_accounts set display_name='Updated name' where id=account_id;
  if (select session_version from staff_accounts where id=account_id) <> original_version + 2 then
    raise exception 'Display name edits unnecessarily revoked sessions';
  end if;
  begin
    update staff_accounts set configured_username='another source' where id=account_id;
    raise exception 'TEST: configured identity was mutable';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    insert into staff_accounts(username,display_name,password_hash,role_id,configured_username)
      values('dupe.' || replace(account_id::text,'-',''),'Duplicate','hash',role_id,tag);
    raise exception 'TEST: duplicate configured identity accepted';
  exception when unique_violation then null; end;

  update staff_roles set permissions=array['care','members'] where key='pastor';
  if (select permissions from staff_roles where key='pastor') <> array['care','members'] then
    raise exception 'Built-in role permissions were not editable';
  end if;
  begin
    update staff_roles set permissions=array['members'] where key='admin';
    raise exception 'TEST: administrator management access removed';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    update staff_roles set permissions=array['members','overview'] where key='fellowship_leader';
    raise exception 'TEST: fellowship leader gained church-wide access';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    update staff_roles set key='renamed_identity' where key='pastor';
    raise exception 'TEST: role identity changed';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    delete from staff_roles where key='welfare';
    raise exception 'TEST: built-in role deleted';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end $$;
rollback;
