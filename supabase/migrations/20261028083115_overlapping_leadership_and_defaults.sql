begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

create function app_private.higher_designation(a text,b text) returns text
language sql immutable security invoker set search_path='' as $$
  select case when a is not null and a not in ('Member','BSCT Leader','Cell Leader','Fellowship Leader') then a
    when coalesce(array_position(array['Member','BSCT Leader','Cell Leader','Fellowship Leader'],a),0) >=
      coalesce(array_position(array['Member','BSCT Leader','Cell Leader','Fellowship Leader'],b),0) then a else b end;
$$;

create function app_private.structure_designation(p_id uuid,p_fellowship text,p_cell uuid,p_bsct uuid,p_active boolean)
returns text language sql stable security invoker set search_path='' as $$
  select case
    when exists(select 1 from public.staff_accounts a join public.staff_roles r on r.id=a.role_id
      where a.member_id=p_id and a.fellowship=p_fellowship and a.is_active and r.key='fellowship_leader') then 'Fellowship Leader'
    when p_active and exists(select 1 from public.fellowship_cells c where c.leader_member_id=p_id and c.id=p_cell and c.fellowship=p_fellowship) then 'Cell Leader'
    when p_active and exists(select 1 from public.fellowship_bsct_groups b join public.fellowship_cells c on c.id=b.cell_id
      where b.leader_member_id=p_id and b.id=p_bsct and c.id=p_cell and c.fellowship=p_fellowship) then 'BSCT Leader'
    else 'Member' end;
$$;

create function app_private.refresh_structure_designation(p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.members%rowtype; expected text;
begin
  if p_id is null then return; end if;
  select * into m from public.members where id=p_id for update;
  if not found then return; end if;
  expected := app_private.structure_designation(m.id,m.fellowship,m.cell_id,m.bsct_group_id,m.is_active and m.merged_into_id is null);
  -- Fellowship leadership also exists as a roster designation without an account.
  if m.designation='Fellowship Leader' then expected := 'Fellowship Leader'; end if;
  if m.designation in ('Member','BSCT Leader','Cell Leader','Fellowship Leader') and m.designation is distinct from expected then
    update public.members set designation=expected,updated_at=now() where id=m.id;
  end if;
end $$;

create or replace function public.validate_member_structure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(NEW.is_active,false) or NEW.merged_into_id is not null then
    NEW.cell_id := null; NEW.bsct_group_id := null;
    return NEW;
  end if;
  if TG_OP='UPDATE' then
    if NEW.fellowship is distinct from OLD.fellowship and NEW.cell_id is not distinct from OLD.cell_id then NEW.cell_id := null; end if;
    if NEW.cell_id is distinct from OLD.cell_id and NEW.bsct_group_id is not distinct from OLD.bsct_group_id then NEW.bsct_group_id := null; end if;
  end if;
  if NEW.cell_id is not null and not exists(select 1 from public.fellowship_cells where id=NEW.cell_id and fellowship=NEW.fellowship) then
    raise exception 'The selected cell does not belong to this fellowship'; end if;
  if NEW.bsct_group_id is not null and not exists(select 1 from public.fellowship_bsct_groups where id=NEW.bsct_group_id and cell_id=NEW.cell_id) then
    raise exception 'The selected BSCT group does not belong to this cell'; end if;
  NEW.designation := app_private.higher_designation(NEW.designation,
    app_private.structure_designation(NEW.id,NEW.fellowship,NEW.cell_id,NEW.bsct_group_id,true));
  return NEW;
end $$;

create or replace function public.clear_moved_structure_leaders() returns trigger
language plpgsql security definer set search_path='' as $$
declare cells_cleared integer; groups_cleared integer;
begin
  -- Role labels no longer make the independent leader references exclusive.
  update public.fellowship_cells set leader_member_id=null,updated_at=now()
    where leader_member_id=NEW.id and (not coalesce(NEW.is_active,false) or NEW.merged_into_id is not null
      or id is distinct from NEW.cell_id or fellowship is distinct from NEW.fellowship);
  get diagnostics cells_cleared=row_count;
  update public.fellowship_bsct_groups b set leader_member_id=null,updated_at=now()
    where b.leader_member_id=NEW.id and (not coalesce(NEW.is_active,false) or NEW.merged_into_id is not null
      or b.id is distinct from NEW.bsct_group_id or b.cell_id is distinct from NEW.cell_id);
  get diagnostics groups_cleared=row_count;
  if cells_cleared+groups_cleared>0 then perform app_private.refresh_structure_designation(NEW.id); end if;
  return NEW;
end $$;

create or replace function public.save_fellowship_cell(p_fellowship text,p_cell_id uuid default null,p_leader_id uuid default null)
returns public.fellowship_cells language plpgsql security invoker set search_path='' as $$
declare c public.fellowship_cells%rowtype; previous_leader uuid;
begin
  if nullif(trim(p_fellowship),'') is null then raise exception 'Choose a fellowship'; end if;
  perform pg_advisory_xact_lock(61801,hashtext(p_fellowship));
  if p_cell_id is null then
    insert into public.fellowship_cells(fellowship,number) select p_fellowship,coalesce(max(number),0)+1 from public.fellowship_cells where fellowship=p_fellowship returning * into c;
  else
    select * into c from public.fellowship_cells where id=p_cell_id and fellowship=p_fellowship for update;
    if not found then raise exception 'Cell not found in your fellowship'; end if;
  end if;
  previous_leader := c.leader_member_id;
  if p_leader_id is not null then
    perform 1 from public.members where id=p_leader_id and fellowship=p_fellowship and is_active and merged_into_id is null for update;
    if not found then raise exception 'Choose an active leader from this fellowship'; end if;
    update public.members set cell_id=c.id,designation=app_private.higher_designation(designation,'Cell Leader'),updated_at=now() where id=p_leader_id;
  end if;
  update public.fellowship_cells set leader_member_id=p_leader_id,updated_at=now() where id=c.id returning * into c;
  perform app_private.refresh_structure_designation(p_leader_id);
  if previous_leader is distinct from p_leader_id then perform app_private.refresh_structure_designation(previous_leader); end if;
  return c;
end $$;

create or replace function public.save_fellowship_bsct_group(p_fellowship text,p_cell_id uuid,p_group_id uuid default null,p_leader_id uuid default null)
returns public.fellowship_bsct_groups language plpgsql security invoker set search_path='' as $$
declare b public.fellowship_bsct_groups%rowtype; previous_leader uuid;
begin
  perform pg_advisory_xact_lock(61801,hashtext(p_fellowship));
  perform 1 from public.fellowship_cells where id=p_cell_id and fellowship=p_fellowship for update;
  if not found then raise exception 'Cell not found in your fellowship'; end if;
  if p_group_id is null then
    insert into public.fellowship_bsct_groups(cell_id,number) select p_cell_id,coalesce(max(number),0)+1 from public.fellowship_bsct_groups where cell_id=p_cell_id returning * into b;
  else
    select * into b from public.fellowship_bsct_groups where id=p_group_id and cell_id=p_cell_id for update;
    if not found then raise exception 'BSCT group not found in this cell'; end if;
  end if;
  previous_leader := b.leader_member_id;
  if p_leader_id is not null then
    perform 1 from public.members where id=p_leader_id and fellowship=p_fellowship and is_active and merged_into_id is null for update;
    if not found then raise exception 'Choose an active leader from this fellowship'; end if;
    update public.members set cell_id=p_cell_id,bsct_group_id=b.id,designation=app_private.higher_designation(designation,'BSCT Leader'),updated_at=now() where id=p_leader_id;
  end if;
  update public.fellowship_bsct_groups set leader_member_id=p_leader_id,updated_at=now() where id=b.id returning * into b;
  perform app_private.refresh_structure_designation(p_leader_id);
  if previous_leader is distinct from p_leader_id then perform app_private.refresh_structure_designation(previous_leader); end if;
  return b;
end $$;

create function app_private.ensure_fellowship_leader_defaults(p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.members%rowtype; c public.fellowship_cells%rowtype; b public.fellowship_bsct_groups%rowtype;
begin
  select * into m from public.members where id=p_id and is_active and merged_into_id is null and designation='Fellowship Leader';
  if not found or nullif(trim(m.fellowship),'') is null or m.fellowship='Unassigned' then return; end if;
  perform pg_advisory_xact_lock(61801,hashtext(m.fellowship));
  insert into public.fellowship_cells(fellowship,number) values(m.fellowship,1) on conflict(fellowship,number) do nothing;
  select * into c from public.fellowship_cells where fellowship=m.fellowship and number=1 for update;
  insert into public.fellowship_bsct_groups(cell_id,number) values(c.id,1) on conflict(cell_id,number) do nothing;
  select * into b from public.fellowship_bsct_groups where cell_id=c.id and number=1 for update;
  -- Defaults fill empty positions; explicit memberships and leaders are kept.
  if m.cell_id is not null and m.cell_id<>c.id then return; end if;
  update public.members set cell_id=c.id,bsct_group_id=coalesce(bsct_group_id,b.id),updated_at=now()
    where id=m.id and (cell_id is distinct from c.id or bsct_group_id is null);
  if c.leader_member_id is null and not exists(select 1 from public.fellowship_cells where leader_member_id=m.id) then
    perform public.save_fellowship_cell(m.fellowship,c.id,m.id);
  end if;
  select * into m from public.members where id=p_id;
  if m.bsct_group_id=b.id and b.leader_member_id is null and not exists(select 1 from public.fellowship_bsct_groups where leader_member_id=m.id) then
    perform public.save_fellowship_bsct_group(m.fellowship,c.id,b.id,m.id);
  end if;
end $$;

create function app_private.initialize_fellowship_leader_structure() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if pg_trigger_depth()>1 or not NEW.is_active or NEW.merged_into_id is not null or NEW.designation<>'Fellowship Leader' then return NEW; end if;
  if TG_OP='INSERT' then perform app_private.ensure_fellowship_leader_defaults(NEW.id);
  elsif OLD.designation is distinct from NEW.designation or OLD.fellowship is distinct from NEW.fellowship or not OLD.is_active then
    perform app_private.ensure_fellowship_leader_defaults(NEW.id);
  end if;
  return NEW;
end $$;
create trigger initialize_fellowship_leader_structure after insert or update of designation,fellowship,is_active,merged_into_id on public.members
for each row execute function app_private.initialize_fellowship_leader_structure();

create function app_private.sync_account_fellowship_leadership() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if NEW.is_active and NEW.member_id is not null and exists(select 1 from public.staff_roles where id=NEW.role_id and key='fellowship_leader') then
    update public.members set designation='Fellowship Leader',updated_at=now()
      where id=NEW.member_id and fellowship=NEW.fellowship and is_active and merged_into_id is null and designation is distinct from 'Fellowship Leader';
    perform app_private.ensure_fellowship_leader_defaults(NEW.member_id);
  end if;
  return NEW;
end $$;
create trigger sync_account_fellowship_leadership after insert or update of member_id,role_id,fellowship,is_active on public.staff_accounts
for each row execute function app_private.sync_account_fellowship_leadership();

revoke all on function public.validate_member_structure(),public.clear_moved_structure_leaders(),
  public.save_fellowship_cell(text,uuid,uuid),public.save_fellowship_bsct_group(text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_fellowship_cell(text,uuid,uuid),public.save_fellowship_bsct_group(text,uuid,uuid,uuid) to service_role;
revoke all on function app_private.higher_designation(text,text),app_private.structure_designation(uuid,text,uuid,uuid,boolean),
  app_private.refresh_structure_designation(uuid),app_private.ensure_fellowship_leader_defaults(uuid),
  app_private.initialize_fellowship_leader_structure(),app_private.sync_account_fellowship_leadership() from public,anon,authenticated;
grant execute on function app_private.higher_designation(text,text),app_private.structure_designation(uuid,text,uuid,uuid,boolean),
  app_private.refresh_structure_designation(uuid),app_private.ensure_fellowship_leader_defaults(uuid),
  app_private.initialize_fellowship_leader_structure(),app_private.sync_account_fellowship_leadership() to service_role;

-- Recover fellowship designations overwritten by the old exclusive-role saves.
-- Account/member links prove identity; no names or attendance rows are inferred.
update public.members m set designation='Fellowship Leader',updated_at=now()
where m.is_active and m.merged_into_id is null and m.designation is distinct from 'Fellowship Leader'
  and exists(select 1 from public.staff_accounts a join public.staff_roles r on r.id=a.role_id
    where a.member_id=m.id and a.fellowship=m.fellowship and a.is_active and r.key='fellowship_leader');
do $$ declare m record; begin
  for m in select id from public.members where is_active and merged_into_id is null and designation='Fellowship Leader' order by fellowship,id loop
    perform app_private.ensure_fellowship_leader_defaults(m.id);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
