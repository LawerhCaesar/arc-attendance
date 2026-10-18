'use client';

import { useState } from 'react';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { fellowshipBreakdown, type FellowshipCell, type BsctGroup, type StructureMember } from '@/lib/fellowship-structure';
import DismissibleBanner from './DismissibleBanner';

interface Props {
  members: (StructureMember & { designation: string })[];
  cells: FellowshipCell[];
  bsctGroups: BsctGroup[];
  fellowshipScope?: string;
  loading?: boolean;
  onChanged: () => Promise<void>;
  onEditMember: (id: string) => void;
}

function LeaderPicker({ label, leaderId, members, disabled, onSave }: {
  label: string; leaderId: string | null; members: StructureMember[]; disabled: boolean; onSave: (id: string | null) => void;
}) {
  const [selected, setSelected] = useState(leaderId || '');
  return <div className="flex flex-wrap items-end gap-2">
    <label className="min-w-0 flex-1 text-xs font-semibold text-gray-600">{label}
      <select value={selected} disabled={disabled} onChange={event => setSelected(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm font-normal text-gray-900">
        <option value="">No leader assigned</option>
        {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    </label>
    <button type="button" disabled={disabled || selected === (leaderId || '')} onClick={() => onSave(selected || null)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40">Save leader</button>
  </div>;
}

export default function FellowshipStructure({ members, cells, bsctGroups, fellowshipScope, loading = false, onChanged, onEditMember }: Props) {
  const [chosenFellowship, setChosenFellowship] = useState(FELLOWSHIPS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const disabled = busy || loading;
  const fellowship = fellowshipScope || chosenFellowship;
  const brethren = members.filter(member => member.fellowship === fellowship);
  const breakdown = fellowshipBreakdown(members, cells, bsctGroups, fellowship);
  const save = async (kind: 'cell' | 'bsct', cellId?: string, id?: string, leaderId: string | null = null) => {
    if (disabled) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/members/structure', {
        method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, fellowship, cellId, id, leaderId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save this group.');
      await onChanged();
      setNotice(id ? 'Leader assignment saved.' : `${kind === 'cell' ? 'Cell' : 'BSCT'} ${result.number} created.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this group.'); }
    finally { setBusy(false); }
  };
  const memberList = (list: StructureMember[]) => <ul className="max-h-48 space-y-1 overflow-y-auto">
    {list.map(member => <li key={member.id}><button type="button" disabled={disabled} onClick={() => onEditMember(member.id)} className="text-left text-sm text-blue-700 underline decoration-blue-200 hover:decoration-blue-700">{member.name}</button></li>)}
  </ul>;

  return <section className="space-y-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="fellowship-structure-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 id="fellowship-structure-heading" className="text-lg font-bold text-gray-900">Cells &amp; BSCT Groups</h3>
        <p className="mt-1 text-sm text-gray-600">{fellowship} · {brethren.length} brethren · {breakdown.cells.length} cells</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!fellowshipScope && <select aria-label="Fellowship for cell breakdown" value={chosenFellowship} disabled={disabled} onChange={event => setChosenFellowship(event.target.value)} className="rounded-lg border border-gray-300 bg-white p-2 text-sm">{FELLOWSHIPS.map(name => <option key={name}>{name}</option>)}</select>}
        <button type="button" disabled={disabled} onClick={() => save('cell')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">+ Create Cell</button>
      </div>
    </div>
    <p className="text-xs leading-5 text-gray-500">Select a brother or sister to edit their details and assign their cell and BSCT group. Assigning a leader also places them in that cell or group and sets their designation.</p>
    {error && <DismissibleBanner role="alert" onDismiss={() => setError('')} className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</DismissibleBanner>}
    {notice && <DismissibleBanner onDismiss={() => setNotice('')} className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</DismissibleBanner>}
    <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-amber-900">Not assigned to a cell ({breakdown.unassigned.length})</summary>
      <div className="mt-3">{memberList(breakdown.unassigned)}</div>
    </details>
    {!breakdown.cells.length && <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Create Cell 1 to start organizing this fellowship. New cells are numbered automatically.</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {breakdown.cells.map(cell => <article key={cell.id} className="space-y-4 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-2"><h4 className="font-bold text-gray-900">Cell {cell.number}</h4><span className="text-xs text-gray-500">{cell.members.length} brethren · {cell.groups.length} BSCT groups</span></div>
        <LeaderPicker key={`${cell.id}-${cell.leader_member_id}`} label={`Cell ${cell.number} leader`} leaderId={cell.leader_member_id} members={brethren} disabled={disabled} onSave={id => save('cell', undefined, cell.id, id)} />
        <details className="rounded-lg bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-gray-700">All cell members ({cell.members.length})</summary><div className="mt-2">{memberList(cell.members)}</div></details>
        <details className="rounded-lg bg-amber-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-amber-900">Not assigned to a BSCT group ({cell.unassigned.length})</summary><div className="mt-2">{memberList(cell.unassigned)}</div></details>
        {cell.groups.map(group => <div key={group.id} className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <h5 className="text-sm font-bold text-indigo-950">BSCT {group.number} <span className="font-normal text-gray-500">· {group.members.length} brethren</span></h5>
          <LeaderPicker key={`${group.id}-${group.leader_member_id}`} label={`Cell ${cell.number}, BSCT ${group.number} leader`} leaderId={group.leader_member_id} members={cell.members} disabled={disabled} onSave={id => save('bsct', cell.id, group.id, id)} />
          {memberList(group.members)}
        </div>)}
        <button type="button" disabled={disabled} onClick={() => save('bsct', cell.id)} className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-40">+ Create BSCT Group</button>
      </article>)}
    </div>
  </section>;
}
