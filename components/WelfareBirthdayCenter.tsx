'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface BirthdayPerson {
  id?: string;
  name: string;
  phone: string;
  fellowship: string;
  birthdayLabel: string;
  nextBirthday: string;
  daysUntil: number;
}

export default function WelfareBirthdayCenter() {
  const [people, setPeople] = useState<BirthdayPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fellowship, setFellowship] = useState('all');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/welfare/birthdays?days=60');
      if (!response.ok) throw new Error('Unable to load birthdays');
      const result = await response.json();
      setPeople(result.birthdays || []);
    } catch {
      setError('Birthdays could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fellowships = useMemo(() => Array.from(new Set(people.map(person => person.fellowship))).sort(), [people]);
  const filtered = people.filter(person => {
    const term = search.trim().toLowerCase();
    return (!term || person.name.toLowerCase().includes(term) || person.phone.includes(term)) &&
      (fellowship === 'all' || person.fellowship === fellowship);
  });
  const sevenDayReminders = people.filter(person => person.daysUntil === 7).length;
  const oneDayReminders = people.filter(person => person.daysUntil === 1).length;

  if (isLoading) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-200" />)}</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-100 bg-white p-8 text-center"><p className="text-sm text-red-700">{error}</p><button onClick={load} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Next 7 days', value: people.filter(person => person.daysUntil <= 7).length, color: 'text-rose-700' },
          { label: 'Next 30 days', value: people.filter(person => person.daysUntil <= 30).length, color: 'text-pink-700' },
          { label: '7-day emails today', value: sevenDayReminders, color: 'text-violet-700' },
          { label: '1-day emails today', value: oneDayReminders, color: 'text-amber-700' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
            <p className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
        <h2 className="font-bold text-rose-950">Automatic welfare reminders</h2>
        <p className="mt-1 text-sm leading-6 text-rose-800">
          A daily check sends one email to <strong>lakumbie@gmail.com</strong> seven days before each birthday and another one day before. Delivery history prevents duplicates.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Birthday calendar</h2>
            <p className="mt-0.5 text-xs text-gray-500">Upcoming birthdays in the next 60 days</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search a person…" className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none" />
            <select value={fellowship} onChange={event => setFellowship(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="all">All fellowships</option>
              {fellowships.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">No birthdays match the selected filters.</div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(person => (
              <article key={`${person.id || person.name}-${person.nextBirthday}`} className="rounded-xl border border-gray-100 p-4 hover:border-rose-200 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{person.name}</p>
                    <p className="mt-1 truncate text-xs text-gray-500">{person.fellowship}</p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-center text-rose-700">
                    <p className="text-[10px] font-bold uppercase">{person.daysUntil === 0 ? 'Today' : 'In'}</p>
                    <p className="text-sm font-bold">{person.daysUntil === 0 ? '🎉' : `${person.daysUntil} ${person.daysUntil === 1 ? 'day' : 'days'}`}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-700">{person.birthdayLabel}</p>
                <div className="mt-4 flex gap-2">
                  {person.phone ? <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800">Call</a> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
