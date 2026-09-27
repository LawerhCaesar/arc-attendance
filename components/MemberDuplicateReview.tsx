'use client';

import { useCallback, useEffect, useState } from 'react';

interface DuplicateMember {
  id: string;
  name: string;
  phone?: string;
  fellowship?: string;
  designation?: string;
  birthday?: string;
  location?: string;
}

interface DuplicateGroup {
  groupKey: string;
  anchor: DuplicateMember;
  matches: DuplicateMember[];
  memberIds: string[];
  matchCount: number;
  confidence: 'high' | 'medium';
  score: number;
  reasons: string[];
}

interface MemberDuplicateReviewProps {
  onRosterChanged: () => Promise<void>;
  refreshKey?: number;
}

function MemberCard({ member, selected, onSelect }: { member: DuplicateMember; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{member.name}</p>
          <p className="mt-1 text-xs text-gray-500">{member.designation || 'Member'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {selected ? 'Primary' : 'Select'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div><dt className="text-gray-400">Phone</dt><dd className="mt-0.5 font-medium text-gray-700">{member.phone || 'Not recorded'}</dd></div>
        <div><dt className="text-gray-400">Fellowship</dt><dd className="mt-0.5 font-medium text-gray-700">{member.fellowship || 'Unassigned'}</dd></div>
        <div><dt className="text-gray-400">Birthday</dt><dd className="mt-0.5 font-medium text-gray-700">{member.birthday || 'Not recorded'}</dd></div>
        <div><dt className="text-gray-400">Location</dt><dd className="mt-0.5 font-medium text-gray-700">{member.location || 'Not recorded'}</dd></div>
      </dl>
    </button>
  );
}

export default function MemberDuplicateReview({ onRosterChanged, refreshKey = 0 }: MemberDuplicateReviewProps) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [primaryByGroup, setPrimaryByGroup] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [workingGroup, setWorkingGroup] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/member-duplicates?page=${targetPage}&pageSize=5`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Duplicate scan failed');
      setGroups(result.groups || []);
      setPage(result.page || 1);
      setTotalPages(result.totalPages || 1);
      setTotalCandidates(result.totalCandidates || 0);
      setTotalGroups(result.totalGroups || 0);
      setPrimaryByGroup(Object.fromEntries((result.groups || []).map((group: DuplicateGroup) => [group.groupKey, group.anchor.id])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Duplicate scan failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page, refreshKey]);

  const decide = async (group: DuplicateGroup, action: 'keep_separate' | 'merge') => {
    if (action === 'merge' && !confirm(`Merge ${group.matchCount} matching record(s) into the selected primary? Existing values will be preserved and empty fields will be filled from the other records.`)) return;
    setWorkingGroup(group.groupKey);
    setError('');
    try {
      const response = await fetch('/api/admin/member-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          anchorId: group.anchor.id,
          memberIds: group.memberIds,
          primaryId: primaryByGroup[group.groupKey],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Decision could not be saved');
      if (action === 'merge') await onRosterChanged();
      const targetPage = groups.length === 1 && page > 1 ? page - 1 : page;
      if (targetPage !== page) setPage(targetPage);
      else await load(targetPage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Decision could not be saved');
    } finally {
      setWorkingGroup(null);
    }
  };

  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-amber-50" />;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-amber-950">Possible duplicate members</h3>
            <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900">{totalGroups}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-800">Each primary record is grouped with all related matches. No record is merged automatically.</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-amber-900">{expanded ? 'Hide' : 'Review'}</span>
      </button>

      {error && <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-700">{error}</div>}
      {expanded && (
        <div className="space-y-4 border-t border-amber-200 bg-white p-4">
          {groups.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">No unresolved duplicate groups.</div>
          ) : groups.map(group => (
            <article key={group.groupKey} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${group.confidence === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{group.confidence} confidence</span>
                  <span className="text-xs font-semibold text-gray-500">Up to {group.score}% match</span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{group.matchCount} possible match{group.matchCount === 1 ? '' : 'es'}</span>
                </div>
                <p className="text-xs text-gray-500">{group.reasons.slice(0, 3).join(' · ')}</p>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Primary record</p>
                <MemberCard member={group.anchor} selected={primaryByGroup[group.groupKey] === group.anchor.id} onSelect={() => setPrimaryByGroup(current => ({ ...current, [group.groupKey]: group.anchor.id }))} />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Possible matches</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.matches.map(member => (
                    <MemberCard key={member.id} member={member} selected={primaryByGroup[group.groupKey] === member.id} onSelect={() => setPrimaryByGroup(current => ({ ...current, [group.groupKey]: member.id }))} />
                  ))}
                </div>
                {group.matchCount > group.matches.length && (
                  <p className="mt-3 rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-600">+ {group.matchCount - group.matches.length} more matching record(s) included in this group</p>
                )}
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={workingGroup === group.groupKey} onClick={() => decide(group, 'keep_separate')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Keep group separate</button>
                <button type="button" disabled={workingGroup === group.groupKey} onClick={() => decide(group, 'merge')} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{workingGroup === group.groupKey ? 'Merging group…' : `Merge all ${group.matchCount} into selected primary`}</button>
              </div>
            </article>
          ))}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-4 sm:flex-row">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} · {totalGroups} groups · {totalCandidates} related records</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1 || isLoading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">Previous</button>
                <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages || isLoading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
