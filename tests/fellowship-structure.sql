-- Run after the fellowship migration against a disposable database. All fixtures
-- are rolled back. These assertions exercise actual functions and triggers.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  c1 public.fellowship_cells%rowtype; c2 public.fellowship_cells%rowtype;
  foreign_cell public.fellowship_cells%rowtype;
  g1 public.fellowship_bsct_groups%rowtype; g2 public.fellowship_bsct_groups%rowtype;
  tag text := 'structure-test-' || gen_random_uuid()::text;
begin
  insert into members(id,name,fellowship) values(a,'A',tag),(b,'B',tag),(outsider,'Other',tag || '-foreign');
  c1 := save_fellowship_cell(tag);
  c2 := save_fellowship_cell(tag);
  foreign_cell := save_fellowship_cell(tag || '-foreign');
  if c1.number <> 1 or c2.number <> 2 or foreign_cell.number <> 1 then raise exception 'Cells must be numbered within each fellowship'; end if;
  g1 := save_fellowship_bsct_group(tag,c1.id);
  g2 := save_fellowship_bsct_group(tag,c2.id);
  if g1.number <> 1 or g2.number <> 1 then raise exception 'BSCT groups must be numbered within each cell'; end if;

  c1 := save_fellowship_cell(tag,c1.id,a);
  if c1.leader_member_id <> a or not exists(select 1 from members where id=a and cell_id=c1.id and designation='Cell Leader') then
    raise exception 'Cell leader must also be assigned to the cell';
  end if;
  g1 := save_fellowship_bsct_group(tag,c1.id,g1.id,b);
  if g1.leader_member_id <> b or not exists(select 1 from members where id=b and cell_id=c1.id and bsct_group_id=g1.id and designation='BSCT Leader') then
    raise exception 'BSCT leader must belong to its cell and group';
  end if;

  begin
    perform save_fellowship_cell(tag,c1.id,outsider);
    raise exception 'TEST: accepted a foreign leader';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    perform save_fellowship_bsct_group(tag,foreign_cell.id,null,a);
    raise exception 'TEST: accepted a foreign cell';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    perform save_fellowship_bsct_group(tag,c1.id,g2.id,b);
    raise exception 'TEST: accepted a BSCT group from another cell';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    update members set cell_id=foreign_cell.id where id=a;
    raise exception 'TEST: accepted foreign cell membership';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin
    update members set bsct_group_id=g2.id where id=b;
    raise exception 'TEST: accepted BSCT membership in another cell';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  if (select leader_member_id from fellowship_cells where id=c1.id) <> a then raise exception 'Failed leader assignment changed the existing leader'; end if;

  -- Moving within a fellowship clears the old group and leader link.
  update members set cell_id=c2.id where id=b;
  if (select bsct_group_id from members where id=b) is not null or
    (select leader_member_id from fellowship_bsct_groups where id=g1.id) is not null then
    raise exception 'Moving a member left old BSCT assignments';
  end if;
  -- Fellowship transfers and removal clear stale structure links.
  update members set fellowship=tag || '-foreign' where id=a;
  if (select cell_id from members where id=a) is not null or
    (select leader_member_id from fellowship_cells where id=c1.id) is not null then
    raise exception 'Fellowship transfer left old cell assignments';
  end if;
  c2 := save_fellowship_cell(tag,c2.id,b);
  update members set is_active=false where id=b;
  if (select cell_id from members where id=b) is not null or
    (select leader_member_id from fellowship_cells where id=c2.id) is not null then
    raise exception 'Removed members must not remain cell leaders';
  end if;

  if has_table_privilege('anon','public.members','UPDATE') or has_table_privilege('authenticated','public.members','INSERT') then
    raise exception 'A public Supabase client can bypass server roster checks';
  end if;
  if has_table_privilege('anon','public.fellowship_cells','SELECT') or
    has_function_privilege('anon','public.save_fellowship_cell(text,uuid,uuid)','EXECUTE') or
    has_function_privilege('authenticated','public.save_fellowship_bsct_group(text,uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Structure is exposed outside server authorization';
  end if;
  if not has_function_privilege('service_role','public.save_fellowship_cell(text,uuid,uuid)','EXECUTE') then
    raise exception 'Server cannot manage fellowship cells';
  end if;
  if (select permissions from staff_roles where key='fellowship_leader') <> array['members']::text[] then
    raise exception 'Leader accounts have incorrect tab permissions';
  end if;
  begin
    update staff_roles set permissions=array['entry'] where key='fellowship_leader';
    raise exception 'TEST: built-in role protection was not restored';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end $$;
rollback;
