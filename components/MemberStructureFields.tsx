'use client';

import { useId } from 'react';
import type { FellowshipStructureData } from '@/lib/fellowship-structure';
import useFellowshipData from './useFellowshipData';

export default function MemberStructureFields({ fellowship, cellId, bsctGroupId, disabled, onChange }: {
  fellowship: string; cellId?: string | null; bsctGroupId?: string | null; disabled?: boolean;
  onChange: (value: { cell_id: string | null; bsct_group_id: string | null }) => void;
}) {
  const id = useId();
  const { data, error, loading, reload } = useFellowshipData<FellowshipStructureData>('/api/members/structure');
  const cells = (data?.cells || []).filter(cell => cell.fellowship === fellowship);
  const groups = (data?.bsctGroups || []).filter(group => group.cell_id === cellId && cells.some(cell => cell.id === group.cell_id));
  const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100';
  return <div className="space-y-3 sm:col-span-2">
    <label htmlFor={`${id}-cell`} className="block text-sm font-medium text-gray-700">Cell
      <select id={`${id}-cell`} aria-label="Cell" disabled={disabled || loading || Boolean(error)} value={cellId || ''} onChange={event => onChange({ cell_id: event.target.value || null, bsct_group_id: null })} className={inputClass}>
        <option value="">Not assigned to a cell</option>
        {cellId && !cells.some(cell => cell.id === cellId) && <option value={cellId}>Current cell (unavailable)</option>}
        {cells.map(cell => <option key={cell.id} value={cell.id}>Cell {cell.number}</option>)}
      </select>
    </label>
    <label htmlFor={`${id}-bsct`} className="block text-sm font-medium text-gray-700">BSCT group
      <select id={`${id}-bsct`} aria-label="BSCT group" disabled={disabled || loading || Boolean(error) || !cellId} value={bsctGroupId || ''} onChange={event => onChange({ cell_id: cellId || null, bsct_group_id: event.target.value || null })} className={inputClass}>
        <option value="">Not assigned to a BSCT group</option>
        {bsctGroupId && !groups.some(group => group.id === bsctGroupId) && <option value={bsctGroupId}>Current BSCT group (unavailable)</option>}
        {groups.map(group => <option key={group.id} value={group.id}>BSCT {group.number}</option>)}
      </select>
    </label>
    {loading ? <p className="text-xs text-gray-600">Loading cells and BSCT groups…</p> : error ? <p role="alert" className="text-sm text-red-800">{error} <button type="button" onClick={reload} className="font-semibold underline">Retry groups</button></p> : <p className="text-xs text-gray-600">Create groups and manage leader assignments in Cells &amp; BSCTs. Leadership roles can overlap; the roster keeps the highest designation.</p>}
  </div>;
}
