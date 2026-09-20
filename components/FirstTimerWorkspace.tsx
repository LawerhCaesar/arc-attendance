'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const stages = ['new', 'contacted', 'invited_back', 'returned', 'fellowship_assigned', 'member'] as const;
type Stage = (typeof stages)[number] | 'closed';

const stageLabels: Record<Stage, string> = {
  new: 'New', contacted: 'Contacted', invited_back: 'Invited back', returned: 'Returned',
  fellowship_assigned: 'Fellowship assigned', member: 'Member', closed: 'Closed',
};

interface Journey {
  id: string | null;
  personId: string | null;
  name: string;
  phone: string;
  fellowship: string;
  location: string;
  firstVisitDate: string;
  stage: Stage;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  outcome: string;
  readOnly: boolean;
}

const nextStage = (stage: Stage): Stage | null => {
  const index = stages.indexOf(stage as (typeof stages)[number]);
  return index >= 0 && index < stages.length - 1 ? stages[index + 1] : null;
};

export default function FirstTimerWorkspace() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [source, setSource] = useState<'legacy' | 'normalized'>('normalized');
  const [activeStage, setActiveStage] = useState<Stage | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/first-timers/journeys');
      if (!response.ok) throw new Error('Unable to load progression');
      const result = await response.json();
      setJourneys(result.journeys || []);
      setSource(result.source || 'normalized');
    } catch {
      setError('First-timer progression could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const advance = async (journey: Journey) => {
    const stage = nextStage(journey.stage);
    if (!journey.id || !stage) return;
    setUpdatingId(journey.id);
    setError('');
    try {
      const response = await fetch('/api/first-timers/journeys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: journey.id, stage }),
      });
      if (!response.ok) throw new Error('Update failed');
      setJourneys(current => current.map(item => item.id === journey.id ? { ...item, stage } : item));
    } catch {
      setError('The progression update failed. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = journeys.filter(journey => {
    const term = search.trim().toLowerCase();
    return (activeStage === 'all' || journey.stage === activeStage) &&
      (!term || journey.name.toLowerCase().includes(term) || journey.phone.includes(term) || journey.fellowship.toLowerCase().includes(term));
  });
  const counts = useMemo(() => Object.fromEntries(stages.map(stage => [stage, journeys.filter(journey => journey.stage === stage).length])), [journeys]);

  if (isLoading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-gray-200" />)}</div>;

  return (
    <div className="space-y-6">
      {source === 'legacy' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Existing first timers are shown from attendance history. Apply the department migration and configure the service-role key to save progression changes.
        </div>
      )}
      {error && <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map(stage => (
          <button key={stage} onClick={() => setActiveStage(activeStage === stage ? 'all' : stage)} className={`rounded-2xl border p-4 text-left shadow-sm transition ${activeStage === stage ? 'border-violet-400 bg-violet-50' : 'border-gray-100 bg-white hover:border-violet-200'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stageLabels[stage]}</p>
            <p className="mt-2 text-2xl font-bold text-violet-700">{counts[stage] || 0}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-gray-900">First-timer progression</h2>
            <p className="mt-0.5 text-xs text-gray-500">Move each visitor toward connection and membership</p>
          </div>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, phone, fellowship…" className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none sm:w-72" />
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">No first timers match this view.</div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((journey, index) => {
              const upcomingStage = nextStage(journey.stage);
              return (
                <article key={journey.id || `${journey.name}-${journey.firstVisitDate}-${index}`} className="rounded-xl border border-gray-100 p-4 hover:border-violet-200 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">{journey.name}</h3>
                      <p className="mt-1 truncate text-xs text-gray-500">{journey.fellowship} · {journey.location || 'Location not recorded'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">{stageLabels[journey.stage]}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-gray-400">First visit</dt><dd className="mt-1 font-medium text-gray-700">{journey.firstVisitDate || 'Unknown'}</dd></div>
                    <div><dt className="text-gray-400">Next follow-up</dt><dd className="mt-1 font-medium text-gray-700">{journey.nextFollowUpAt?.slice(0, 10) || 'Not scheduled'}</dd></div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {journey.phone ? <a href={`tel:${journey.phone.replace(/[^\d+]/g, '')}`} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700">Call</a> : null}
                    {upcomingStage && !journey.readOnly ? (
                      <button onClick={() => advance(journey)} disabled={updatingId === journey.id} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
                        {updatingId === journey.id ? 'Updating…' : `Move to ${stageLabels[upcomingStage]}`}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
