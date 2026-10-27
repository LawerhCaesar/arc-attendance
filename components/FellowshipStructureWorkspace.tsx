'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Member } from '@/lib/database';
import FellowshipStructure from './FellowshipStructure';
import MemberDetailsModal from './MemberDetailsModal';
import type { FellowshipStructureData } from '@/lib/fellowship-structure';

export default function FellowshipStructureWorkspace({ fellowship, onRosterChanged }: { fellowship: string; onRosterChanged: () => void }) {
  const [members, setMembers] = useState<(Member & { id: string })[]>([]);
  const [structure, setStructure] = useState<FellowshipStructureData>({ cells: [], bsctGroups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const responses = await Promise.all(['/api/members?status=all', '/api/members/structure'].map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load fellowship groups.');
        return body;
      }));
      setMembers(responses[0].filter((member: Member) => member.id && member.is_active !== false && !member.merged_into_id && member.fellowship === fellowship));
      setStructure(responses[1]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load fellowship groups.'); throw caught; }
    finally { setLoading(false); }
  }, [fellowship]);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-gray-950">Cells &amp; BSCTs</h2><p className="mt-1 text-sm text-gray-600">Organize {fellowship} brethren and assign leaders. Attendance breakdowns are in Fellowship Attendance History.</p></div>
      <button type="button" disabled={loading} onClick={() => void load().catch(() => {})} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Refresh groups</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {loading && <p role="status" className="text-sm text-gray-600">Loading fellowship groups…</p>}
    {!error && <FellowshipStructure members={members} cells={structure.cells} bsctGroups={structure.bsctGroups} fellowshipScope={fellowship} loading={loading}
      onChanged={async () => { await load(); onRosterChanged(); }} onEditMember={setEditingId} />}
    {editingId && <MemberDetailsModal memberId={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); onRosterChanged(); void load().catch(() => {}); }} />}
  </div>;
}
