-- Run after the original structure migration and the bulk structure migration
-- in a disposable database. All synthetic records are rolled back.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); outsider uuid := gen_random_uuid(); archived uuid := gen_random_uuid(); merged uuid := gen_random_uuid();
  c1 public.fellowship_cells%rowtype; c2 public.fellowship_cells%rowtype; foreign_cell public.fellowship_cells%rowtype;
  g1 public.fellowship_bsct_groups%rowtype; g2 public.fellowship_bsct_groups%rowtype; g3 public.fellowship_bsct_groups%rowtype;
  result jsonb; original_attendance jsonb; original_count integer;
begin
  insert into members(id,name,fellowship,is_active,merged_into_id) values(a,'A','Shalach',true,null),(b,'B','Shalach',true,null),
    (outsider,'Other','Pleroma',true,null),(archived,'Archived','Shalach',false,null),(merged,'Merged','Shalach',false,a);
  insert into attendance(member_id,name,fellowship,date,"attendanceStatus") values(a,'A','Shalach','2026-10-18','present'),(b,'B','Shalach','2026-10-25','absent');
  select jsonb_agg(to_jsonb(t) order by id) into original_attendance from attendance t;
  select count(*) into original_count from members;
  c1 := save_fellowship_cell('Shalach'); c2 := save_fellowship_cell('Shalach'); foreign_cell := save_fellowship_cell('Pleroma');
  c1 := save_fellowship_cell('Shalach',c1.id,a);
  g1 := save_fellowship_bsct_group('Shalach',c1.id,null,b);
  g2 := save_fellowship_bsct_group('Shalach',c2.id);
  result := assign_fellowship_members('Shalach',array[a,b,a],c2.id,g2.id);
  if result->>'assigned' <> '2' or (select count(*) from members where id=any(array[a,b]) and cell_id=c2.id and bsct_group_id=g2.id and designation='Member') <> 2 then
    raise exception 'Bulk assignment did not move the entire distinct selection';
  end if;
  if (select leader_member_id from fellowship_cells where id=c1.id) is not null or (select leader_member_id from fellowship_bsct_groups where id=g1.id) is not null then
    raise exception 'Bulk movement retained a leader link to the old group';
  end if;

  begin perform assign_fellowship_members('Shalach',array[a,outsider],c1.id); raise exception 'TEST: accepted foreign brethren';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin perform assign_fellowship_members('Shalach',array[a,archived],c1.id); raise exception 'TEST: accepted archived brethren';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin perform assign_fellowship_members('Shalach',array[a,merged],c1.id); raise exception 'TEST: accepted merged brethren';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin perform assign_fellowship_members('Shalach',array[a],foreign_cell.id); raise exception 'TEST: accepted a foreign cell';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin perform assign_fellowship_members('Shalach',array[a],c2.id,g1.id); raise exception 'TEST: accepted a mismatched BSCT';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin perform assign_fellowship_members('Shalach',array[]::uuid[],c1.id); raise exception 'TEST: accepted an empty batch';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  if (select count(*) from members where id=any(array[a,b]) and cell_id=c2.id and bsct_group_id=g2.id) <> 2 then raise exception 'Rejected batches partially changed membership'; end if;

  -- A cell-only batch removes BSCT membership but keeps the selected cell.
  perform assign_fellowship_members('Shalach',array[a],c2.id);
  if (select cell_id from members where id=a) <> c2.id or (select bsct_group_id from members where id=a) is not null then raise exception 'Cell-only assignment failed'; end if;
  g2 := save_fellowship_bsct_group('Shalach',c2.id,g2.id,b);
  result := delete_fellowship_structure('Shalach','bsct',g2.id);
  if result->>'deleted' <> 'true' or exists(select 1 from fellowship_bsct_groups where id=g2.id) or
    (select cell_id from members where id=b) <> c2.id or (select bsct_group_id from members where id=b) is not null or (select designation from members where id=b) <> 'Member' then
    raise exception 'Deleting a BSCT removed its cell membership or retained its leader designation';
  end if;
  g3 := save_fellowship_bsct_group('Shalach',c2.id,null,b);
  c2 := save_fellowship_cell('Shalach',c2.id,a);
  begin perform delete_fellowship_structure('Pleroma','cell',c2.id); raise exception 'TEST: deleted a foreign cell';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  begin perform delete_fellowship_structure('Pleroma','bsct',g3.id); raise exception 'TEST: deleted a foreign group';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
  result := delete_fellowship_structure('Shalach','cell',c2.id);
  if result->>'unassigned' <> '2' or exists(select 1 from fellowship_cells where id=c2.id) or exists(select 1 from fellowship_bsct_groups where id=g3.id) or
    exists(select 1 from members where id=any(array[a,b]) and (cell_id is not null or bsct_group_id is not null or designation <> 'Member' or not is_active)) then
    raise exception 'Cell deletion did not clear assignments and child groups safely';
  end if;
  if not exists(select 1 from fellowship_cells where id=foreign_cell.id) or not exists(select 1 from members where id=outsider and fellowship='Pleroma') then raise exception 'A foreign fellowship changed'; end if;
  if (select count(*) from members) <> original_count or (select jsonb_agg(to_jsonb(t) order by id) from attendance t) is distinct from original_attendance then raise exception 'Bulk actions changed members or attendance history'; end if;
  if has_function_privilege('anon','public.assign_fellowship_members(text,uuid[],uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.delete_fellowship_structure(text,text,uuid)','EXECUTE') then raise exception 'Public clients can bypass staff scope'; end if;
  if not has_function_privilege('service_role','public.assign_fellowship_members(text,uuid[],uuid,uuid)','EXECUTE') then raise exception 'Server cannot assign members'; end if;
end $$;
rollback;
