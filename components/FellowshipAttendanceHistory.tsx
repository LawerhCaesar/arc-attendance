'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dateInAccra } from '@/lib/birthdays';
import type { FellowshipAttendanceReport } from '@/lib/fellowship-insights';
import useFellowshipData from './useFellowshipData';

const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function recentStart() { const date = new Date(`${dateInAccra()}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - 90); return date.toISOString().slice(0, 10); }
export default function FellowshipAttendanceHistory() {
  const { data, error, loading, reload } = useFellowshipData<FellowshipAttendanceReport>('/api/fellowship/attendance');
  const [start, setStart] = useState(recentStart);
  const [end, setEnd] = useState(dateInAccra);
  const [memberId, setMemberId] = useState('all');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(true);
  const invalidRange = Boolean(start && end && start > end);
  const visibleMembers = useMemo(() => (data?.members || []).filter(member =>
    (includeArchived || !member.archived) && (memberId === 'all' || member.id === memberId) && member.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map(member => ({ ...member, history: member.history.filter(row => (!start || row.date >= start) && (!end || row.date <= end)) })),
  [data, start, end, memberId, search, includeArchived]);
  const services = useMemo(() => {
    const dates = new Map<string, { date: string; present: number; absent: number }>();
    for (const member of visibleMembers) for (const row of member.history) {
      const service = dates.get(row.date) || { date: row.date, present: 0, absent: 0 };
      service[row.status]++; dates.set(row.date, service);
    }
    return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [visibleMembers]);
  const present = services.reduce((sum, service) => sum + service.present, 0);
  const absent = services.reduce((sum, service) => sum + service.absent, 0);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-gray-950">Attendance history</h2><p className="mt-1 text-sm text-gray-600">{data?.fellowship ? `${data.fellowship} · ` : ''}Fellowship attendance by service and by brother or sister.</p></div><button onClick={reload} disabled={loading} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Refresh history</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={reload} className="underline">Retry</button></p>}
    <section aria-label="Attendance filters" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-gray-700">From<input type="date" value={start} max={end || data?.today} onChange={event => setStart(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-gray-700">To<input type="date" value={end} min={start} max={data?.today} onChange={event => setEnd(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2" /></label>
        <button onClick={() => { setStart(''); setEnd(data?.today || dateInAccra()); }} className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">All history</button>
        <label className="text-sm font-medium text-gray-700">Member<select value={memberId} onChange={event => setMemberId(event.target.value)} className="mt-1 block max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="all">All brethren</option>{data?.members.map(member => <option key={member.id} value={member.id}>{member.name}{member.archived ? ' (archived)' : ''}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-4"><input aria-label="Search attendance by name" placeholder="Search brethren by name…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />Include archived brethren</label></div>
      <p className="text-xs text-gray-600">Only recorded present/absent entries count. Missing check-ins are not assumed absent. Overlapping records count once per person per service.</p>
      {invalidRange && <p role="alert" className="text-sm text-red-800">Choose a start date on or before the end date.</p>}
    </section>
    {loading ? <p role="status" className="py-8 text-gray-600">Loading attendance history…</p> : data && !error && !invalidRange && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Brethren', visibleMembers.length], ['Services with records', services.length], ['Present entries', present], ['Absent entries', absent]].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-600">{label}</p><p className="mt-1 text-2xl font-bold text-gray-950">{value}</p></div>)}</div>
      <section aria-label="Attendance graph" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-gray-950">Attendance by service</h3><p className="mt-1 text-sm text-gray-600">The graph follows the filters above. Exact counts are listed below.</p>{services.length ? <div className="mt-5 h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={services} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={date => dateLabel(date).replace(/ \d{4}$/, '')} tick={{ fontSize: 12 }} minTickGap={25} /><YAxis allowDecimals={false} width={35} /><Tooltip labelFormatter={label => dateLabel(String(label))} /><Legend /><Bar dataKey="present" name="Present" fill="#2563eb" radius={[3, 3, 0, 0]} /><Bar dataKey="absent" name="Absent" fill="#d97706" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="py-12 text-center text-gray-600">No recorded attendance in this view.</p>}</section>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><h3 className="px-5 pt-5 font-bold text-gray-950">Brethren attendance</h3><p className="px-5 pb-4 pt-1 text-sm text-gray-600">Expand a name to see their recorded service dates.</p><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{['Name / service dates', 'Present', 'Absent', 'Last attended'].map(label => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{visibleMembers.map(member => { const attended = member.history.filter(row => row.status === 'present'); return <tr key={member.id}><td className="px-5 py-4 align-top"><details><summary className="cursor-pointer font-semibold text-blue-900">{member.name}{member.archived && <span className="ml-2 text-xs font-normal text-gray-600">Archived</span>}</summary>{member.history.length ? <ul className="mt-3 space-y-2">{member.history.map(row => <li key={row.date} className="flex flex-wrap gap-3 text-gray-700"><time dateTime={row.date}>{dateLabel(row.date)}</time><span className={row.status === 'present' ? 'text-blue-800' : 'text-amber-800'}>{row.status === 'present' ? 'Present' : 'Absent'}</span></li>)}</ul> : <p className="mt-2 font-normal text-gray-600">No records in this period.</p>}</details></td><td className="px-5 py-4 align-top">{attended.length}</td><td className="px-5 py-4 align-top">{member.history.length - attended.length}</td><td className="whitespace-nowrap px-5 py-4 align-top text-gray-600">{attended[0] ? dateLabel(attended[0].date) : 'Not recorded'}</td></tr>; })}</tbody></table></div>{!visibleMembers.length && <p className="p-8 text-center text-gray-600">No brethren match your filters.</p>}</section>
      {services.length > 0 && <details className="rounded-xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-gray-900">Service totals — data behind the graph</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Service date</th><th>Present</th><th>Absent</th></tr></thead><tbody>{[...services].reverse().map(service => <tr key={service.date} className="border-t border-gray-100"><td className="py-2">{dateLabel(service.date)}</td><td>{service.present}</td><td>{service.absent}</td></tr>)}</tbody></table></div></details>}
      {data.unlinkedRecords > 0 && <p className="text-sm text-gray-600">{data.unlinkedRecords} historical records could not be linked unambiguously to this fellowship’s roster and are excluded from member totals.</p>}
    </>}
  </div>;
}
