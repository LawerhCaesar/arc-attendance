'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UpcomingBirthday } from '@/lib/birthdays';
import CallMemberButton from './CallMemberButton';

interface BirthdayList { fellowship: string; today: string; windowDays: number; birthdays: (UpcomingBirthday & { phone: string })[] }

export default function UpcomingFellowshipBirthdays() {
  const [data, setData] = useState<BirthdayList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/account/birthdays', { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load upcoming birthdays.');
      setData(result);
    } catch (caught) {
      if (!signal?.aborted) setError((caught as Error).message);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return <section aria-labelledby="upcoming-birthdays-heading" aria-busy={loading} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="upcoming-birthdays-heading" className="text-lg font-bold text-gray-950">Upcoming birthdays</h2>
        <p className="mt-1 text-sm text-gray-600">{data ? `${data.fellowship} · Today and the next ${data.windowDays} days` : 'Brethren in your fellowship'}</p></div>
      <button type="button" disabled={loading} onClick={() => void load()} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">Refresh birthdays</button>
    </div>
    {loading ? <p className="mt-5 text-sm text-gray-600" role="status">Loading birthdays…</p>
      : error ? <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>
      : !data?.birthdays.length ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-gray-600">No birthdays coming up in your fellowship in the next {data?.windowDays || 60} days.</p>
      : <ul className="mt-4 divide-y divide-gray-100">{data.birthdays.map(person => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-words font-semibold text-gray-950">{person.name}</p><time dateTime={person.nextBirthday} className="mt-1 block text-sm text-gray-600">{person.birthdayLabel}</time></div>
        <div className="flex flex-wrap items-center gap-3"><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${person.daysUntil === 0 ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'}`}>{person.daysUntil === 0 ? 'Today' : person.daysUntil === 1 ? 'Tomorrow' : `In ${person.daysUntil} days`}</span><CallMemberButton name={person.name} phone={person.phone} /></div>
      </li>)}</ul>}
  </section>;
}
