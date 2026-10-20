'use client';
import { useState } from 'react';
import type { FellowshipBirthday } from '@/lib/fellowship-insights';
import useFellowshipData from './useFellowshipData';
import CallMemberButton from './CallMemberButton';

const months = Array.from({ length: 12 }, (_, month) => new Date(Date.UTC(2000, month, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }));
export default function FellowshipBirthdays() {
  const { data, error, loading, reload } = useFellowshipData<{ fellowship: string; members: FellowshipBirthday[] }>('/api/fellowship/birthdays');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const members = (data?.members || []).filter(member => member.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (month === 'all' || (month === 'missing' ? member.month === null : member.month === Number(month))));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold text-gray-950">Fellowship birthdays</h2><p className="mt-1 text-sm text-gray-600">{data?.fellowship ? `${data.fellowship} · ` : ''}All active brethren, ordered by their next birthday.</p></div>
      <button type="button" onClick={reload} disabled={loading} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Refresh birthdays</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={reload} className="underline">Retry</button></p>}
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <input aria-label="Search birthdays by name" placeholder="Search brethren by name…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select aria-label="Birthday month" value={month} onChange={event => setMonth(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="all">All months</option>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}<option value="missing">Missing / invalid birthdays</option></select>
      </div>
      {loading ? <p role="status" className="py-8 text-gray-600">Loading birthdays…</p> : !error && <>
        <p className="mt-3 text-sm text-gray-600">{members.length} of {data?.members.length || 0} brethren · {data?.members.filter(member => member.month === null).length || 0} need birthday details</p>
        {!members.length ? <p className="py-10 text-center text-gray-600">No brethren match this view.</p> : <ul className="mt-4 divide-y divide-gray-100">{members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div><p className="font-semibold text-gray-950">{member.name}</p><p className={`mt-1 text-sm ${member.birthdayLabel ? 'text-gray-600' : 'text-amber-800'}`}>{member.birthdayLabel || 'Birthday missing or invalid — update in Member Roster'}</p></div>
          <div className="flex flex-wrap items-center gap-3">{member.daysUntil !== null && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${member.daysUntil === 0 ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-700'}`}>{member.daysUntil === 0 ? 'Today' : member.daysUntil === 1 ? 'Tomorrow' : `In ${member.daysUntil} days`}</span>}<CallMemberButton name={member.name} phone={member.phone} /></div>
        </li>)}</ul>}
      </>}
    </section>
  </div>;
}
