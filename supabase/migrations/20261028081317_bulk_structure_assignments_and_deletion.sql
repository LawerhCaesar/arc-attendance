begin;

-- Staff sessions and fellowship scope are checked in the server API. These
-- invoker functions are callable only by that server's service role.
create function public.assign_fellowship_members(
  p_fellowship text, p_member_ids uuid[], p_cell_id uuid, p_bsct_group_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_ids uuid[]; v_count integer;
begin
  if nullif(trim(p_fellowship), '') is null or p_cell_id is null then raise exception 'Choose a fellowship and cell'; end if;
  if p_member_ids is null or cardinality(p_member_ids) not between 1 and 1000 or array_position(p_member_ids, null) is not null then
    raise exception 'Select between 1 and 1000 active brethren';
  end if;
  v_ids := array(select distinct id from unnest(p_member_ids) id order by id);
  perform pg_advisory_xact_lock(61801, hashtext(p_fellowship));
  -- Lock parents before members, including old groups whose leader references
  -- the existing membership triggers may clear when a leader moves.
  perform 1 from fellowship_cells where fellowship=p_fellowship order by id for update;
  perform 1 from fellowship_bsct_groups where cell_id in (select id from fellowship_cells where fellowship=p_fellowship) order by id for update;
  if not exists(select 1 from fellowship_cells where id=p_cell_id and fellowship=p_fellowship) then
    raise exception 'Cell not found in your fellowship';
  end if;
  if p_bsct_group_id is not null and not exists(select 1 from fellowship_bsct_groups where id=p_bsct_group_id and cell_id=p_cell_id) then
    raise exception 'BSCT group not found in the selected cell';
  end if;
  perform 1 from members where id=any(v_ids) and fellowship=p_fellowship and is_active and merged_into_id is null order by id for update;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then raise exception 'Some selected brethren are no longer active in your fellowship. Refresh and select them again'; end if;
  update members set cell_id=p_cell_id, bsct_group_id=p_bsct_group_id,
    designation=case
      when designation='Cell Leader' and cell_id is distinct from p_cell_id then 'Member'
      when designation='BSCT Leader' and bsct_group_id is distinct from p_bsct_group_id then 'Member'
      else designation end,
    updated_at=now()
  where id=any(v_ids) and fellowship=p_fellowship and is_active and merged_into_id is null;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then raise exception 'The full selection could not be assigned. No changes were saved'; end if;
  return jsonb_build_object('assigned',v_count,'cellId',p_cell_id,'bsctGroupId',p_bsct_group_id);
end $$;

create function public.delete_fellowship_structure(p_fellowship text, p_kind text, p_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_cell_id uuid; v_count integer; v_groups integer := 0;
begin
  if nullif(trim(p_fellowship), '') is null or p_id is null or p_kind is null or p_kind not in ('cell','bsct') then
    raise exception 'Choose a valid cell or BSCT group';
  end if;
  perform pg_advisory_xact_lock(61801, hashtext(p_fellowship));
  perform 1 from fellowship_cells where fellowship=p_fellowship order by id for update;
  perform 1 from fellowship_bsct_groups where cell_id in (select id from fellowship_cells where fellowship=p_fellowship) order by id for update;
  if p_kind='cell' then
    select id into v_cell_id from fellowship_cells where id=p_id and fellowship=p_fellowship;
    if not found then raise exception 'Cell not found in your fellowship'; end if;
    if exists(select 1 from members where cell_id=p_id and fellowship is distinct from p_fellowship) then raise exception 'This cell has inconsistent assignments. Ask an administrator to review it'; end if;
    select count(*) into v_groups from fellowship_bsct_groups where cell_id=p_id;
    update members set cell_id=null,bsct_group_id=null,
      designation=case when designation in ('Cell Leader','BSCT Leader') then 'Member' else designation end, updated_at=now()
    where cell_id=p_id and fellowship=p_fellowship;
    get diagnostics v_count = row_count;
    delete from fellowship_cells where id=p_id and fellowship=p_fellowship;
  else
    select c.id into v_cell_id from fellowship_bsct_groups b join fellowship_cells c on c.id=b.cell_id
    where b.id=p_id and c.fellowship=p_fellowship;
    if not found then raise exception 'BSCT group not found in your fellowship'; end if;
    if exists(select 1 from members where bsct_group_id=p_id and fellowship is distinct from p_fellowship) then raise exception 'This BSCT group has inconsistent assignments. Ask an administrator to review it'; end if;
    update members set bsct_group_id=null,
      designation=case when designation='BSCT Leader' then 'Member' else designation end, updated_at=now()
    where bsct_group_id=p_id and fellowship=p_fellowship;
    get diagnostics v_count = row_count;
    delete from fellowship_bsct_groups where id=p_id and cell_id=v_cell_id;
    v_groups := 1;
  end if;
  return jsonb_build_object('deleted',true,'unassigned',v_count,'removedBsctGroups',v_groups);
end $$;

revoke all on function public.assign_fellowship_members(text,uuid[],uuid,uuid), public.delete_fellowship_structure(text,text,uuid) from public, anon, authenticated;
grant execute on function public.assign_fellowship_members(text,uuid[],uuid,uuid), public.delete_fellowship_structure(text,text,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
