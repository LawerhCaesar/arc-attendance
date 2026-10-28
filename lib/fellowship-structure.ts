export interface FellowshipCell {
  id: string;
  fellowship: string;
  number: number;
  leader_member_id: string | null;
}
export interface BsctGroup {
  id: string;
  cell_id: string;
  number: number;
  leader_member_id: string | null;
}
export interface FellowshipStructureData { cells: FellowshipCell[]; bsctGroups: BsctGroup[] }

export interface StructureMember {
  id: string;
  name: string;
  fellowship: string;
  cell_id?: string | null;
  bsct_group_id?: string | null;
  designation?: string;
}

/** Leadership references are independent; the roster label is the highest role. */
export function structureLeadershipRoles(member: StructureMember, cells: FellowshipCell[], groups: BsctGroup[]): string[] {
  const ownCells = cells.filter(cell => cell.fellowship === member.fellowship);
  const roles = [
    ...(member.designation === 'Fellowship Leader' ? ['Fellowship Leader'] : []),
    ...(member.designation === 'Cell Leader' || ownCells.some(cell => cell.id === member.cell_id && cell.leader_member_id === member.id) ? ['Cell Leader'] : []),
    ...(member.designation === 'BSCT Leader' || groups.some(group => group.id === member.bsct_group_id && group.leader_member_id === member.id && ownCells.some(cell => cell.id === group.cell_id && cell.id === member.cell_id)) ? ['BSCT Leader'] : []),
  ];
  return roles.length ? roles : [member.designation || 'Member'];
}

export function fellowshipBreakdown(members: StructureMember[], cells: FellowshipCell[], groups: BsctGroup[], fellowship: string) {
  const brethren = members.filter(member => member.fellowship === fellowship);
  return {
    unassigned: brethren.filter(member => !member.cell_id),
    cells: cells.filter(cell => cell.fellowship === fellowship).sort((a, b) => a.number - b.number).map(cell => {
      const cellMembers = brethren.filter(member => member.cell_id === cell.id);
      return {
        ...cell, members: cellMembers,
        unassigned: cellMembers.filter(member => !member.bsct_group_id),
        groups: groups.filter(group => group.cell_id === cell.id).sort((a, b) => a.number - b.number).map(group => ({
          ...group, members: cellMembers.filter(member => member.bsct_group_id === group.id),
        })),
      };
    }),
  };
}
