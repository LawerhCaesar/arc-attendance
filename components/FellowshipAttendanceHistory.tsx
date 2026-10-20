'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dateInAccra } from '@/lib/birthdays';
import type { FellowshipAttendanceReport } from '@/lib/fellowship-insights';
import useFellowshipData from './useFellowshipData';
import { FELLOWSHIPS } from '@/lib/fellowships';
import CallMemberButton from './CallMemberButton';

const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function recentStart() { const date = new Date(`${dateInAccra()}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - 90); return date.toISOString().slice(0, 10); }
export default function FellowshipAttendanceHistory({ canChooseFellowship = false }: { canChooseFellowship?: boolean }) {
  const [fellowship, setFellowship] = useState(FELLOWSHIPS[0]);
  const { data, error, loading, reload } = useFellowshipData<FellowshipAttendanceReport>(`/api/fellowship/attendance${canChooseFellowship ? `?fellowship=${encodeURIComponent(fellowship)}` : ''}`);
  const [start, setStart] = useState(recentStart);
  const [end, setEnd] = useState(dateInAccra);
  const [memberId, setMemberId] = useState('all');
  const [search, setSearch] = useState('');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const Chart = chartType === 'line' ? LineChart : BarChart;
  const invalidRange = Boolean(start && end && start > end);
  const visibleMembers = useMemo(() => (data?.members || []).filter(member =>
    !member.archived && (memberId === 'all' || member.id === memberId) && member.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map(member => ({ ...member, history: member.history.filter(row => (!start || row.date >= start) && (!end || row.date <= end)) })),
  [data, start, end, memberId, search]);
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
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-gray-950">Fellowship attendance history</h2><p className="mt-1 text-sm text-gray-600">{data?.fellowship ? `${data.fellowship} · ` : ''}Attendance by service and by brother or sister.</p></div><button onClick={reload} disabled={loading} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Refresh history</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={reload} className="underline">Retry</button></p>}
    <section aria-label="Attendance filters" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        {canChooseFellowship && <label className="text-sm font-medium text-gray-700">Fellowship<select value={fellowship} onChange={event => { setFellowship(event.target.value); setMemberId('all'); setSearch(''); }} className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2">{FELLOWSHIPS.map(name => <option key={name}>{name}</option>)}</select></label>}
        <label className="text-sm font-medium text-gray-700">From<input type="date" value={start} max={end || data?.today} onChange={event => setStart(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-gray-700">To<input type="date" value={end} min={start} max={data?.today} onChange={event => setEnd(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2" /></label>
        <button onClick={() => { setStart(''); setEnd(data?.today || dateInAccra()); }} className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">All history</button>
        <label className="text-sm font-medium text-gray-700">Member<select value={memberId} onChange={event => setMemberId(event.target.value)} className="mt-1 block max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="all">All brethren</option>{data?.members.map(member => <option key={member.id} value={member.id}>{member.name}{member.archived ? ' (archived)' : ''}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-4"><input aria-label="Search attendance by name" placeholder="Search brethren by name…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
      <p className="text-xs text-gray-600">Archived brethren are excluded. Only recorded present/absent entries count. Missing check-ins are not assumed absent. Overlapping records count once per person per service.</p>
      {invalidRange && <p role="alert" className="text-sm text-red-800">Choose a start date on or before the end date.</p>}
    </section>
    {loading ? <p role="status" className="py-8 text-gray-600">Loading attendance history…</p> : data && !error && !invalidRange && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Brethren', visibleMembers.length], ['Services with records', services.length], ['Present entries', present], ['Absent entries', absent]].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-600">{label}</p><p className="mt-1 text-2xl font-bold text-gray-950">{value}</p></div>)}</div>
      <section aria-label="Attendance graph" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-bold text-gray-950">Attendance by service</h3><p className="mt-1 text-sm text-gray-600">The graph follows the filters above. Exact counts are listed below.</p></div>
          <div role="group" aria-label="Attendance chart type" className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(['line', 'bar'] as const).map(type => <button key={type} type="button" aria-pressed={chartType === type} onClick={() => setChartType(type)} className={`rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${chartType === type ? 'bg-blue-700 text-white shadow-sm' : 'text-gray-700 hover:bg-white'}`}>{type === 'line' ? 'Line graph' : 'Bar graph'}</button>)}
          </div>
        </div>
        {services.length ? <div className="mt-5 h-72 w-full" aria-label={`${chartType === 'line' ? 'Line' : 'Bar'} graph of present and absent brethren by service date`}>
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={services} accessibilityLayer margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={date => dateLabel(date).replace(/ \d{4}$/, '')} tick={{ fontSize: 12 }} minTickGap={25} padding={{ left: 10, right: 10 }} />
              <YAxis allowDecimals={false} width={35} />
              <Tooltip labelFormatter={label => dateLabel(String(label))} />
              <Legend />
              {chartType === 'line' && <Line type="linear" dataKey="present" name="Present" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />}
              {chartType === 'line' && <Line type="linear" dataKey="absent" name="Absent" stroke="#d97706" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 4 }} activeDot={{ r: 6 }} />}
              {chartType === 'bar' && <Bar dataKey="present" name="Present" fill="#2563eb" radius={[3, 3, 0, 0]} />}
              {chartType === 'bar' && <Bar dataKey="absent" name="Absent" fill="#d97706" radius={[3, 3, 0, 0]} />}
            </Chart>
          </ResponsiveContainer>
        </div> : <p className="py-12 text-center text-gray-600">No recorded attendance in this view.</p>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <h3 className="px-5 pt-5 font-bold text-gray-950">Brethren attendance</h3><p className="px-5 pb-4 pt-1 text-sm text-gray-600">Expand a name to see their recorded service dates, or call using their saved number.</p>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Name / service dates', 'Present', 'Absent', 'Last attended'].map(label => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">{visibleMembers.map(member => {
            const attended = member.history.filter(row => row.status === 'present');
            return <tr key={member.id}>
              <td className="px-5 py-4 align-top"><div className="flex flex-wrap items-start justify-between gap-3">
                <details className="min-w-0"><summary className="cursor-pointer font-semibold text-blue-900">{member.name}</summary>
                  {member.history.length ? <ul className="mt-3 space-y-2">{member.history.map(row => <li key={row.date} className="flex flex-wrap gap-3 text-gray-700"><time dateTime={row.date}>{dateLabel(row.date)}</time><span className={row.status === 'present' ? 'text-blue-800' : 'text-amber-800'}>{row.status === 'present' ? 'Present' : 'Absent'}</span></li>)}</ul> : <p className="mt-2 font-normal text-gray-600">No records in this period.</p>}
                </details>
                <CallMemberButton name={member.name} phone={member.phone} />
              </div></td>
              <td className="px-5 py-4 align-top">{attended.length}</td><td className="px-5 py-4 align-top">{member.history.length - attended.length}</td><td className="whitespace-nowrap px-5 py-4 align-top text-gray-600">{attended[0] ? dateLabel(attended[0].date) : 'Not recorded'}</td>
            </tr>;
          })}</tbody>
        </table></div>
        {!visibleMembers.length && <p className="p-8 text-center text-gray-600">No brethren match your filters.</p>}
      </section>
      {services.length > 0 && <details className="rounded-xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-gray-900">Service totals — data behind the graph</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Service date</th><th>Present</th><th>Absent</th></tr></thead><tbody>{[...services].reverse().map(service => <tr key={service.date} className="border-t border-gray-100"><td className="py-2">{dateLabel(service.date)}</td><td>{service.present}</td><td>{service.absent}</td></tr>)}</tbody></table></div></details>}
      {data.unlinkedRecords > 0 && <p className="text-sm text-gray-600">{data.unlinkedRecords} historical records could not be linked unambiguously to this fellowship’s roster and are excluded from member totals.</p>}
    </>}
  </div>;
}
