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
