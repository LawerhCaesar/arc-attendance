import type { FellowshipHistoryMember } from './fellowship-insights';
import type { FellowshipStructureData } from './fellowship-structure';

export function matchesCellAttendance(member: FellowshipHistoryMember, structure: FellowshipStructureData, cell: string, bsct: string) {
  const assignedCell = structure.cells.find(item => item.id === member.cell_id);
  const assignedGroup = structure.bsctGroups.find(item => item.id === member.bsct_group_id && item.cell_id === assignedCell?.id);
  return (cell === 'all' || (cell === 'unassigned' ? !assignedCell : assignedCell?.id === cell)) &&
    (bsct === 'all' || (bsct === 'unassigned' ? !assignedGroup : assignedGroup?.id === bsct));
}

export function cellAttendanceBreakdown(members: FellowshipHistoryMember[], structure: FellowshipStructureData) {
  const active = members.filter(member => !member.archived);
  const totals = (list: FellowshipHistoryMember[]) => {
    const services = new Set<string>();
    let present = 0, absent = 0;
    for (const member of list) for (const row of member.history) { services.add(row.date); if (row.status === 'present') present++; else absent++; }
    return { brethren: list.length, present, absent, services: services.size };
  };
  return {
    unassigned: totals(active.filter(member => matchesCellAttendance(member, structure, 'unassigned', 'all'))),
    cells: [...structure.cells].sort((a, b) => a.number - b.number).map(cell => {
      const brethren = active.filter(member => member.cell_id === cell.id);
      return { ...cell, ...totals(brethren),
        unassigned: totals(brethren.filter(member => matchesCellAttendance(member, structure, cell.id, 'unassigned'))),
        groups: structure.bsctGroups.filter(group => group.cell_id === cell.id).sort((a, b) => a.number - b.number)
          .map(group => ({ ...group, ...totals(brethren.filter(member => member.bsct_group_id === group.id)) })),
      };
    }),
  };
}
