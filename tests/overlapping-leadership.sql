-- Run against a disposable database after the overlapping-leadership migration.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tag text := 'leadership-'||gen_random_uuid()::text; occupied text := 'occupied-'||gen_random_uuid()::text;
  c1 public.fellowship_cells%rowtype; c2 public.fellowship_cells%rowtype;
  g1 public.fellowship_bsct_groups%rowtype; g2 public.fellowship_bsct_groups%rowtype;
  before_history jsonb; role_id uuid;
begin
  select jsonb_agg(to_jsonb(t) order by id) into before_history from attendance t;
  insert into members(id,name,fellowship,designation) values(a,'Fellowship Leader',tag,'Fellowship Leader');
  select * into c1 from fellowship_cells where fellowship=tag and number=1;
  select * into g1 from fellowship_bsct_groups where cell_id=c1.id and number=1;
  if c1.leader_member_id is distinct from a or g1.leader_member_id is distinct from a or not exists(select 1 from members where id=a and cell_id=c1.id and bsct_group_id=g1.id and designation='Fellowship Leader') then
    raise exception 'A fellowship leader did not default to both first groups at the highest designation'; end if;
  perform save_fellowship_cell(tag,c1.id,a);
  perform save_fellowship_bsct_group(tag,c1.id,g1.id,a);
  update members set location='Updated location' where id=a;
  if not exists(select 1 from fellowship_cells where id=c1.id and leader_member_id=a) or not exists(select 1 from fellowship_bsct_groups where id=g1.id and leader_member_id=a) or (select designation from members where id=a)<>'Fellowship Leader' then
    raise exception 'Lower-role saves or a details edit removed simultaneous leadership'; end if;

  insert into members(id,name,fellowship) values(b,'Dual cell and BSCT leader',tag),(c,'Replacement leader',tag);
  c2 := save_fellowship_cell(tag,null,b);
  g2 := save_fellowship_bsct_group(tag,c2.id,null,b);
  if (select designation from members where id=b)<>'Cell Leader' or (select leader_member_id from fellowship_cells where id=c2.id) is distinct from b then raise exception 'A cell leader lost their higher role when also becoming BSCT leader'; end if;
  perform save_fellowship_cell(tag,c2.id,c);
  if (select designation from members where id=b)<>'BSCT Leader' or (select leader_member_id from fellowship_bsct_groups where id=g2.id) is distinct from b then raise exception 'Replacing a cell leader removed their remaining BSCT role'; end if;
  perform save_fellowship_cell(tag,c2.id,b);
  if (select designation from members where id=b)<>'Cell Leader' or (select designation from members where id=c)<>'Member' then raise exception 'Highest designations did not follow the current roles'; end if;
  perform delete_fellowship_structure(tag,'bsct',g2.id);
  if (select designation from members where id=b)<>'Cell Leader' or (select leader_member_id from fellowship_cells where id=c2.id) is distinct from b then raise exception 'Deleting a BSCT removed independent cell leadership'; end if;
  g2 := save_fellowship_bsct_group(tag,c2.id,null,b);
  perform assign_fellowship_members(tag,array[b],c2.id,null);
  if (select designation from members where id=b)<>'Cell Leader' or (select leader_member_id from fellowship_cells where id=c2.id) is distinct from b or (select leader_member_id from fellowship_bsct_groups where id=g2.id) is not null then raise exception 'Bulk cell-only assignment lost a valid higher role'; end if;

  -- Explicit choices after default initialization are not pinned back to group 1.
  perform assign_fellowship_members(tag,array[a],c2.id,g2.id);
  update members set location='Still in chosen cell' where id=a;
  perform app_private.ensure_fellowship_leader_defaults(a);
  if (select cell_id from members where id=a) is distinct from c2.id or (select designation from members where id=a)<>'Fellowship Leader' then raise exception 'A default overwrote an explicit membership or highest designation'; end if;

  -- New fellowship leaders join the default groups without replacing their heads.
  update members set fellowship=occupied,cell_id=null,bsct_group_id=null where id=b;
  update members set fellowship=occupied,cell_id=null,bsct_group_id=null where id=c;
  c1 := save_fellowship_cell(occupied,null,b);
  g1 := save_fellowship_bsct_group(occupied,c1.id,null,c);
  insert into members(id,name,fellowship,designation) values(d,'New fellowship leader',occupied,'Fellowship Leader');
  if (select leader_member_id from fellowship_cells where id=c1.id) is distinct from b or (select leader_member_id from fellowship_bsct_groups where id=g1.id) is distinct from c then raise exception 'Defaults replaced existing group leaders'; end if;
  if not exists(select 1 from members where id=d and cell_id=c1.id and bsct_group_id=g1.id and designation='Fellowship Leader') then raise exception 'Default membership was not assigned in occupied first groups'; end if;

  -- Managed fellowship leader accounts protect the designation across detail saves.
  select id into role_id from staff_roles where key='fellowship_leader';
  insert into staff_accounts(member_id,role_id,fellowship,is_active) values(d,role_id,occupied,true);
  update members set designation='Member' where id=d;
  if (select designation from members where id=d)<>'Fellowship Leader' then raise exception 'A lower detail designation overwrote account-backed fellowship leadership'; end if;
  update members set is_active=false where id=d;
  if exists(select 1 from fellowship_cells where leader_member_id=d) or exists(select 1 from fellowship_bsct_groups where leader_member_id=d) then raise exception 'An archived leader retained group roles'; end if;
  if (select jsonb_agg(to_jsonb(t) order by id) from attendance t) is distinct from before_history then raise exception 'Leadership changes modified attendance'; end if;
  if has_function_privilege('anon','public.save_fellowship_cell(text,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.save_fellowship_bsct_group(text,uuid,uuid,uuid)','EXECUTE') then raise exception 'Public role-assignment access was introduced'; end if;
end $$;
rollback;

-- Exercise the exact server role, including RLS and private helper privileges.
-- The role setting and every synthetic row are rolled back together.
begin;
alter role service_role bypassrls;
set local role service_role;
do $$
declare person uuid := gen_random_uuid(); tag text := 'service-role-'||gen_random_uuid()::text; cell uuid; bsct uuid;
begin
  insert into public.members(id,name,fellowship,designation) values(person,'Server role leader',tag,'Fellowship Leader');
  select id into cell from public.fellowship_cells where fellowship=tag and number=1;
  select id into bsct from public.fellowship_bsct_groups where cell_id=cell and number=1;
  perform public.save_fellowship_cell(tag,cell,person);
  perform public.save_fellowship_bsct_group(tag,cell,bsct,person);
  if not exists(select 1 from public.members where id=person and designation='Fellowship Leader') or
    not exists(select 1 from public.fellowship_cells where id=cell and leader_member_id=person) or
    not exists(select 1 from public.fellowship_bsct_groups where id=bsct and leader_member_id=person) then raise exception 'Server role cannot maintain overlapping leadership'; end if;
end $$;
reset role;
rollback;
