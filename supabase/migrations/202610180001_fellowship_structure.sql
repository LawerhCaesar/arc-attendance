-- Fellowship-scoped staff rosters, numbered cells and numbered BSCT groups.
begin;

-- The built-in role is protected against ordinary edits. This migration is the
-- deliberate change from attendance tools to the fellowship roster workspace.
alter table public.staff_roles disable trigger guard_staff_roles;
update public.staff_roles set permissions = array['members']::text[], updated_at = now()
where key = 'fellowship_leader';
alter table public.staff_roles enable trigger guard_staff_roles;

alter table public.staff_accounts add column if not exists member_id uuid references public.members(id) on delete set null;
create unique index if not exists staff_accounts_member_unique on public.staff_accounts(member_id);

create table public.fellowship_cells (
  id uuid primary key default gen_random_uuid(),
  fellowship text not null check (length(trim(fellowship)) > 0),
  number integer not null check (number > 0),
  leader_member_id uuid unique references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fellowship, number)
);
create table public.fellowship_bsct_groups (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.fellowship_cells(id) on delete cascade,
  number integer not null check (number > 0),
  leader_member_id uuid unique references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cell_id, number)
);
alter table public.members add column cell_id uuid references public.fellowship_cells(id) on delete set null;
alter table public.members add column bsct_group_id uuid references public.fellowship_bsct_groups(id) on delete set null;
create index members_cell_idx on public.members(cell_id) where is_active;
create index members_bsct_group_idx on public.members(bsct_group_id) where is_active;

alter table public.fellowship_cells enable row level security;
alter table public.fellowship_bsct_groups enable row level security;
revoke all on public.fellowship_cells, public.fellowship_bsct_groups from anon, authenticated;
grant all on public.fellowship_cells, public.fellowship_bsct_groups to service_role;
-- Local staff sessions are checked by the server. A public Supabase key cannot
-- write around those checks; public attendance can still read its roster.
revoke insert, update, delete on public.members from anon, authenticated;
grant select on public.members to anon, authenticated;
grant all on public.members to service_role;

create function public.validate_member_structure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(NEW.is_active, false) then
    NEW.cell_id := null;
    NEW.bsct_group_id := null;
    return NEW;
  end if;
  if TG_OP = 'UPDATE' then
    if NEW.fellowship is distinct from OLD.fellowship and NEW.cell_id is not distinct from OLD.cell_id then
      NEW.cell_id := null;
    end if;
    if NEW.cell_id is distinct from OLD.cell_id and NEW.bsct_group_id is not distinct from OLD.bsct_group_id then
      NEW.bsct_group_id := null;
    end if;
  end if;
  if NEW.cell_id is not null and not exists (
    select 1 from fellowship_cells c where c.id = NEW.cell_id and c.fellowship = NEW.fellowship
  ) then raise exception 'The selected cell does not belong to this fellowship'; end if;
  if NEW.bsct_group_id is not null and not exists (
    select 1 from fellowship_bsct_groups b where b.id = NEW.bsct_group_id and b.cell_id = NEW.cell_id
  ) then raise exception 'The selected BSCT group does not belong to this cell'; end if;
  return NEW;
end $$;
create trigger validate_member_structure before insert or update on public.members
for each row execute function public.validate_member_structure();

create function public.clear_moved_structure_leaders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update fellowship_cells set leader_member_id = null, updated_at = now()
  where leader_member_id = NEW.id and
    (not coalesce(NEW.is_active, false) or id is distinct from NEW.cell_id or NEW.designation <> 'Cell Leader');
  update fellowship_bsct_groups set leader_member_id = null, updated_at = now()
  where leader_member_id = NEW.id and
    (not coalesce(NEW.is_active, false) or id is distinct from NEW.bsct_group_id or NEW.designation <> 'BSCT Leader');
  return NEW;
end $$;
create trigger clear_moved_structure_leaders after update on public.members
for each row execute function public.clear_moved_structure_leaders();

create function public.save_fellowship_cell(p_fellowship text, p_cell_id uuid default null, p_leader_id uuid default null)
returns public.fellowship_cells language plpgsql security definer set search_path = public as $$
declare v_cell public.fellowship_cells%rowtype;
begin
  if nullif(trim(p_fellowship), '') is null then raise exception 'Choose a fellowship'; end if;
  perform pg_advisory_xact_lock(61801, hashtext(p_fellowship));
  if p_cell_id is null then
    insert into fellowship_cells(fellowship, number)
    select p_fellowship, coalesce(max(number), 0) + 1 from fellowship_cells where fellowship = p_fellowship
    returning * into v_cell;
  else
    select * into v_cell from fellowship_cells where id = p_cell_id and fellowship = p_fellowship for update;
    if not found then raise exception 'Cell not found in your fellowship'; end if;
  end if;
  if p_leader_id is not null then
    perform 1 from members where id = p_leader_id and fellowship = p_fellowship and is_active for update;
    if not found then raise exception 'Choose an active leader from this fellowship'; end if;
    update members set cell_id = v_cell.id, designation = 'Cell Leader', updated_at = now() where id = p_leader_id;
  end if;
  update fellowship_cells set leader_member_id = p_leader_id, updated_at = now() where id = v_cell.id returning * into v_cell;
  return v_cell;
end $$;

create function public.save_fellowship_bsct_group(p_fellowship text, p_cell_id uuid, p_group_id uuid default null, p_leader_id uuid default null)
returns public.fellowship_bsct_groups language plpgsql security definer set search_path = public as $$
declare v_group public.fellowship_bsct_groups%rowtype;
begin
  perform 1 from fellowship_cells where id = p_cell_id and fellowship = p_fellowship for update;
  if not found then raise exception 'Cell not found in your fellowship'; end if;
  if p_group_id is null then
    insert into fellowship_bsct_groups(cell_id, number)
    select p_cell_id, coalesce(max(number), 0) + 1 from fellowship_bsct_groups where cell_id = p_cell_id
    returning * into v_group;
  else
    select * into v_group from fellowship_bsct_groups where id = p_group_id and cell_id = p_cell_id for update;
    if not found then raise exception 'BSCT group not found in this cell'; end if;
  end if;
  if p_leader_id is not null then
    perform 1 from members where id = p_leader_id and fellowship = p_fellowship and is_active for update;
    if not found then raise exception 'Choose an active leader from this fellowship'; end if;
    update members set cell_id = p_cell_id, bsct_group_id = v_group.id, designation = 'BSCT Leader', updated_at = now() where id = p_leader_id;
  end if;
  update fellowship_bsct_groups set leader_member_id = p_leader_id, updated_at = now() where id = v_group.id returning * into v_group;
  return v_group;
end $$;
revoke all on function public.validate_member_structure(), public.clear_moved_structure_leaders() from public, anon, authenticated;
revoke all on function public.save_fellowship_cell(text, uuid, uuid), public.save_fellowship_bsct_group(text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_fellowship_cell(text, uuid, uuid), public.save_fellowship_bsct_group(text, uuid, uuid, uuid) to service_role;
commit;
