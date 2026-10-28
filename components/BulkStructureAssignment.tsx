'use client';

import { useState } from 'react';
import type { StructureMember, FellowshipCell, BsctGroup } from '@/lib/fellowship-structure';

export default function BulkStructureAssignment({ members, cells, groups, disabled, onAssign }: {
  members: StructureMember[]; cells: FellowshipCell[]; groups: BsctGroup[]; disabled: boolean;
  onAssign: (memberIds: string[], cellId: string, bsctGroupId: string | null) => Promise<boolean>;
}) {
  const [search, setSearch] = useState('');
  const [sourceCell, setSourceCell] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [targetCell, setTargetCell] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const selectedIds = selected.filter(id => members.some(member => member.id === id));
  const visible = members.filter(member => member.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (sourceCell === 'all' || (sourceCell === 'unassigned' ? !member.cell_id : member.cell_id === sourceCell)));
  const destinationGroups = groups.filter(group => group.cell_id === targetCell);
  const cellValid = cells.some(cell => cell.id === targetCell);
  const groupValid = !targetGroup || destinationGroups.some(group => group.id === targetGroup);
  const allSelected = visible.length > 0 && visible.every(member => selectedIds.includes(member.id));
  const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100';
  const assign = async () => {
    if (disabled || !cellValid || !groupValid || !selectedIds.length) return;
    if (await onAssign(selectedIds, targetCell, targetGroup || null)) setSelected([]);
  };
  return <section aria-labelledby="bulk-assignment-heading" className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
    <div><h4 id="bulk-assignment-heading" className="font-bold text-gray-950">Assign multiple brethren</h4><p className="mt-1 text-sm text-gray-700">Select brethren below, then choose their destination cell and optional BSCT group. A BSCT assignment also puts them in its cell.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-gray-700">Search brethren<input aria-label="Search brethren for bulk assignment" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name" disabled={disabled} className={inputClass} /></label>
      <label className="text-sm font-medium text-gray-700">Current cell<select aria-label="Filter bulk assignment by current cell" value={sourceCell} onChange={event => setSourceCell(event.target.value)} disabled={disabled} className={inputClass}><option value="all">All brethren</option><option value="unassigned">No cell assigned</option>{cells.map(cell => <option key={cell.id} value={cell.id}>Cell {cell.number}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <label className="flex items-center gap-2 font-semibold text-gray-800"><input type="checkbox" disabled={disabled || !visible.length || (!allSelected && new Set([...selectedIds,...visible.map(member => member.id)]).size > 1000)} checked={allSelected}
        onChange={() => setSelected(allSelected ? selectedIds.filter(id => !visible.some(member => member.id === id)) : [...new Set([...selectedIds,...visible.map(member => member.id)])])} />Select all visible brethren</label>
      <span className="text-gray-700" aria-live="polite">{selectedIds.length} selected · {visible.length} shown <button type="button" disabled={disabled || !selectedIds.length} onClick={() => setSelected([])} className="ml-2 font-semibold text-blue-800 underline disabled:opacity-50">Clear selection</button></span>
    </div>
    <ul className="max-h-64 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 bg-white">
      {visible.map(member => <li key={member.id}><label className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm text-gray-900"><input type="checkbox" className="mt-1" aria-label={`Select ${member.name}`} disabled={disabled || (!selectedIds.includes(member.id) && selectedIds.length >= 1000)} checked={selectedIds.includes(member.id)} onChange={event => setSelected(event.target.checked ? [...selectedIds, member.id] : selectedIds.filter(id => id !== member.id))} />
        <span><span className="block font-semibold">{member.name}</span><span className="mt-0.5 block text-xs text-gray-600">{cells.some(cell => cell.id === member.cell_id) ? `Cell ${cells.find(cell => cell.id === member.cell_id)!.number}` : 'No cell assigned'} · {groups.some(group => group.id === member.bsct_group_id) ? `BSCT ${groups.find(group => group.id === member.bsct_group_id)!.number}` : 'No BSCT assigned'}</span></span>
      </label></li>)}
      {!visible.length && <li className="px-3 py-6 text-sm text-gray-600">No brethren match these filters.</li>}
    </ul>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold text-gray-800">Destination cell<select aria-label="Destination cell" value={targetCell} disabled={disabled} onChange={event => { setTargetCell(event.target.value); setTargetGroup(''); }} className={inputClass}><option value="">Choose a cell</option>{cells.map(cell => <option key={cell.id} value={cell.id}>Cell {cell.number}</option>)}</select></label>
      <label className="text-sm font-semibold text-gray-800">Destination BSCT group<select aria-label="Destination BSCT group" value={targetGroup} disabled={disabled || !cellValid} onChange={event => setTargetGroup(event.target.value)} className={inputClass}><option value="">Cell only (no BSCT)</option>{destinationGroups.map(group => <option key={group.id} value={group.id}>BSCT {group.number}</option>)}</select></label>
    </div>
    <p className="text-xs text-gray-600">Choosing “Cell only” clears existing BSCT assignments for the selected brethren. Moving a leader out of their group clears that leader assignment. Member details and attendance are kept. Select up to 1,000 brethren at a time.</p>
    <button type="button" disabled={disabled || !selectedIds.length || !cellValid || !groupValid} onClick={() => void assign()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Assign {selectedIds.length} selected {selectedIds.length === 1 ? 'member' : 'brethren'}</button>
  </section>;
}
