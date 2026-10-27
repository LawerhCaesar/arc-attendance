'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnassignedMember } from '@/lib/unassigned-members';

export default function UnassignedMemberPicker({ fellowship, onClose, onAssigned }: {
  fellowship: string; onClose: () => void; onAssigned: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [members, setMembers] = useState<UnassignedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/fellowship/unassigned-members', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load unassigned brethren.');
      setMembers(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load unassigned brethren.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { dialog.current?.showModal(); void load(); }, [load]);

  const assign = async (member: UnassignedMember) => {
    setBusy(member.id); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/fellowship/unassigned-members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: member.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setMembers(current => current.filter(person => person.id !== member.id));
        throw new Error(result.error || 'Unable to add this member.');
      }
      setMembers(current => current.filter(person => person.id !== member.id));
      setSuccess(`${member.name} has been added to ${fellowship}.`);
      onAssigned();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add this member.'); }
    finally { setBusy(null); }
  };
  const query = search.trim().toLowerCase();
  const filtered = members.filter(member => [member.name, member.phone, member.location].some(value => (value || '').toLowerCase().includes(query)));

  return <dialog ref={dialog} onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }} aria-labelledby="unassigned-title"
    className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white p-0 text-gray-950 shadow-2xl backdrop:bg-black/40">
    <div className="flex max-h-[85dvh] flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="unassigned-title" className="text-xl font-bold">Add from Unassigned</h2>
          <p className="mt-2 text-sm text-gray-700">Add existing brethren to {fellowship}. Their details and attendance records are kept.</p></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => dialog.current?.close()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Close</button>
      </div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="unassigned-search">Search unassigned brethren</label>
      <input id="unassigned-search" autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, phone or location"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button disabled={Boolean(busy)} onClick={load} className="font-semibold underline">Refresh list</button></p>}
      {success && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>}
      <div className="mt-4 min-h-0 overflow-y-auto" aria-busy={loading}>
        {loading ? <p className="py-6 text-sm text-gray-600">Loading unassigned brethren…</p> : <>
          <p className="mb-2 text-xs text-gray-600">{filtered.length} {filtered.length === 1 ? 'member' : 'members'}</p>
          {!filtered.length && <p className="py-6 text-sm text-gray-700">{members.length ? 'No brethren match this search.' : 'No active unassigned brethren are available.'}</p>}
          <ul className="divide-y divide-gray-200">{filtered.map(member => <li key={member.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="break-words font-semibold">{member.name}</p><p className="mt-1 text-sm text-gray-600">{member.phone || 'No phone'} · {member.location || 'No location'}</p></div>
            <button type="button" disabled={Boolean(busy)} aria-label={`Add ${member.name} to ${fellowship}`} onClick={() => assign(member)}
              className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy === member.id ? 'Adding…' : 'Add to fellowship'}</button>
          </li>)}</ul>
        </>}
      </div>
    </div>
  </dialog>;
}
