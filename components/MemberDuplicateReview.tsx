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

interface Candidate {
  pairKey: string;
  memberA: DuplicateMember;
  memberB: DuplicateMember;
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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [primaryByPair, setPrimaryByPair] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [workingPair, setWorkingPair] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/member-duplicates');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Duplicate scan failed');
      setCandidates(result.candidates || []);
      setPrimaryByPair(Object.fromEntries((result.candidates || []).map((candidate: Candidate) => [candidate.pairKey, candidate.memberA.id])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Duplicate scan failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const decide = async (candidate: Candidate, action: 'keep_separate' | 'merge') => {
    if (action === 'merge' && !confirm('Merge these member records? The selected primary will remain active and the other record will be deactivated.')) return;
    setWorkingPair(candidate.pairKey);
    setError('');
    try {
      const response = await fetch('/api/admin/member-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          memberAId: candidate.memberA.id,
          memberBId: candidate.memberB.id,
          primaryId: primaryByPair[candidate.pairKey],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Decision could not be saved');
      setCandidates(current => current.filter(item => item.pairKey !== candidate.pairKey));
      if (action === 'merge') await onRosterChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Decision could not be saved');
    } finally {
      setWorkingPair(null);
    }
  };

  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-amber-50" />;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-amber-950">Possible duplicate members</h3>
            <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900">{candidates.length}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-800">Review similar names with matching contacts or fellowships. No record is merged automatically.</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-amber-900">{expanded ? 'Hide' : 'Review'}</span>
      </button>

      {error && <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-700">{error}</div>}
      {expanded && (
        <div className="space-y-4 border-t border-amber-200 bg-white p-4">
          {candidates.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">No unresolved duplicate candidates.</div>
          ) : candidates.map(candidate => (
            <article key={candidate.pairKey} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${candidate.confidence === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{candidate.confidence} confidence</span>
                  <span className="text-xs font-semibold text-gray-500">Match score {candidate.score}%</span>
                </div>
                <p className="text-xs text-gray-500">{candidate.reasons.join(' · ')}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MemberCard member={candidate.memberA} selected={primaryByPair[candidate.pairKey] === candidate.memberA.id} onSelect={() => setPrimaryByPair(current => ({ ...current, [candidate.pairKey]: candidate.memberA.id }))} />
                <MemberCard member={candidate.memberB} selected={primaryByPair[candidate.pairKey] === candidate.memberB.id} onSelect={() => setPrimaryByPair(current => ({ ...current, [candidate.pairKey]: candidate.memberB.id }))} />
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={workingPair === candidate.pairKey} onClick={() => decide(candidate, 'keep_separate')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Keep both separate</button>
                <button type="button" disabled={workingPair === candidate.pairKey} onClick={() => decide(candidate, 'merge')} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{workingPair === candidate.pairKey ? 'Saving…' : 'Merge into selected primary'}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
