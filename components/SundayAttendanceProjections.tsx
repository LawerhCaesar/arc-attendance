'use client';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dateInAccra } from '@/lib/birthdays';
import { includeProjectionGuests, parseProjectionGuests, projectionLocked, upcomingSunday, type ProjectionGuest, type ProjectionComparison, type ProjectionReport } from '@/lib/attendance-projections';
import useFellowshipData from './useFellowshipData';

const number = (value: number | null) => value === null ? '—' : value;
const actualLabel = (value: string, future: boolean) => future ? 'Awaiting service' : value === 'present' ? 'Present' : value === 'absent' ? 'Absent' : 'Not recorded';
const inputClass = 'mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm';

export default function SundayAttendanceProjections() {
  const [serviceDate,setServiceDate] = useState(() => upcomingSunday(dateInAccra()));
  const {data,error,loading,reload} = useFellowshipData<ProjectionReport>(`/api/fellowship/projections?date=${encodeURIComponent(serviceDate)}`);
  const [selected,setSelected] = useState<Set<string>>(new Set());
  const [guests,setGuests] = useState<ProjectionGuest[]>([]);
  const [guestName,setGuestName] = useState('');
  const [guestPhone,setGuestPhone] = useState('');
  const [guestError,setGuestError] = useState('');
  const [dirty,setDirty] = useState(false);
  const [draftRevision,setDraftRevision] = useState<number | null>(null);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState('');
  const [saveError,setSaveError] = useState('');
  const [search,setSearch] = useState('');
  const [view,setView] = useState('all');
  const [fellowship,setFellowship] = useState('all');
  const [clock,setClock] = useState(Date.now);
  const leader = Boolean(data?.fellowshipScope);
  const comparison = data?.comparisons[0];
  const editable = Boolean(data?.canEdit && !projectionLocked(serviceDate,new Date(clock)));
  const future = Boolean(data && serviceDate>data.today);
  useEffect(() => {
    const cutoff = Date.parse(`${serviceDate}T09:00:00Z`);
    if (cutoff<=clock) return;
    const timer = setTimeout(() => setClock(Date.now()),Math.min(cutoff-Date.now()+25,2147483647));
    return () => clearTimeout(timer);
  },[serviceDate,clock]);
  useEffect(() => {
    if (data && !dirty) {setSelected(new Set(data.comparisons[0]?.basePeople.filter(person => person.projected).map(person => person.id) || []));setGuests(data.comparisons[0]?.guests || []);setGuestName('');setGuestPhone('');setGuestError('');setDraftRevision(null);}
  },[data,dirty]);
  const people = useMemo(() => leader && editable ? includeProjectionGuests((comparison?.basePeople || []).map(person => ({...person,projected:selected.has(person.id)})),guests) : comparison?.people || [],[comparison,leader,editable,selected,guests]);
  const visiblePeople = people.filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (view==='all' || (view==='projected' && person.projected) || (view==='present' && person.actual==='present') ||
      (view==='projected-missing' && person.projected && person.actual!=='present') || (view==='unexpected' && !person.projected && person.actual==='present')));
  const projected = leader && editable && dirty ? people.filter(person => person.projected).length : comparison?.projected ?? null;
  const came = leader && editable && dirty ? people.filter(person => person.projected && person.actual==='present').length : comparison?.projectedCame ?? null;
  const comparisons = data?.comparisons.filter(item => fellowship==='all' || item.fellowship===fellowship) || [];

  const save = async () => {
    if (!data || !comparison || !editable) return;
    setSaving(true);setSaveError('');setMessage('');
    try {
      const response = await fetch('/api/fellowship/projections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceDate,memberIds:[...selected],guests,revision:draftRevision ?? comparison.revision})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save this projection.');
      setDirty(false);setMessage('Sunday projection saved.');reload();
    } catch(error) { setSaveError(error instanceof Error ? error.message : 'Unable to save this projection.'); }
    finally {setSaving(false);}
  };
  const addGuest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editable || saving || !comparison) return;
    setGuestError('');
    try {
      const next = parseProjectionGuests([...guests,{id:crypto.randomUUID(),name:guestName,phone:guestPhone}]);
      setGuests(next);setGuestName('');setGuestPhone('');
      if (!dirty) setDraftRevision(comparison.revision);
      setDirty(true);setMessage('');
    } catch (error) {setGuestError(error instanceof Error ? error.message : 'Unable to add this visitor.');}
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-gray-950">Sunday attendance projections</h2><p className="mt-1 text-sm text-gray-600">Plan expected attendance and compare it with recorded present attendance.</p></div><button onClick={reload} disabled={loading || saving} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Refresh actual attendance</button></div>
    <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <label className="text-sm font-medium text-gray-700">Sunday service<input type="date" value={serviceDate} disabled={dirty || saving} onChange={event => {setServiceDate(event.target.value);setSearch('');setView('all');setMessage('');setSaveError('');setClock(Date.now());}} className={inputClass} /></label>
      {data && !leader && <label className="text-sm font-medium text-gray-700">Fellowship<select value={fellowship} onChange={event => setFellowship(event.target.value)} className={inputClass}><option value="all">All fellowships</option>{data.comparisons.map(item => <option key={item.fellowship}>{item.fellowship}</option>)}</select></label>}
      <p className="max-w-xl text-sm text-gray-600">Projections lock at <strong>9 a.m. on their Sunday, Ghana time</strong>. Archived brethren are excluded. Actual attendance counts each person once per service, including visitors.</p>
    </section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={reload} className="underline">Retry</button></p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-900">{message}</p>}
    {saveError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800"><p>{saveError}</p><button onClick={() => {setDirty(false);setSaveError('');reload();}} className="mt-2 text-sm font-semibold underline">Discard changes and reload latest projection</button></div>}
    {loading ? <p role="status" className="py-8 text-gray-600">Loading Sunday projections…</p> : data && !error && <>
      {leader && comparison ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4"><div><p className="font-semibold text-blue-950">{comparison.fellowship} · {editable ? 'Open until Sunday 9 a.m.' : 'Projection locked'}</p><p className="mt-1 text-sm text-blue-900">{dirty ? editable ? 'Unsaved selections — save your projection before changing the service date.' : 'The 9 a.m. cutoff has passed. Unsaved selections are not included in the saved projection.' : comparison.submitted ? `Saved by ${comparison.updatedBy || 'fellowship leader'}${comparison.updatedAt ? ` · ${new Date(comparison.updatedAt).toLocaleString('en-GB',{timeZone:'Africa/Accra'})}` : ''}` : 'No projection has been submitted for this Sunday.'}</p></div><div className="flex gap-2">{dirty && <button onClick={() => setDirty(false)} disabled={saving} className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-900">Discard changes</button>}{editable && <button onClick={save} disabled={saving || (!dirty && comparison.submitted)} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save projection'}</button>}</div></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Projected',number(projected)],['Actual present',future ? 'Pending' : comparison.actual],['Projected who came',future ? 'Pending' : number(came)],['Came without projection',future ? 'Pending' : comparison.submitted || (dirty && editable) ? comparison.actual-(came || 0) : '—']].map(([label,value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-600">{label}</p><p className="mt-1 text-2xl font-bold text-gray-950">{value}</p></div>)}</div>
        <section aria-label="Projected first-time visitors" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div><h3 className="font-bold text-gray-950">Expected first-time visitors</h3><p className="mt-1 text-sm text-gray-600">Add brethren who are not in the roster. They count in this Sunday’s projection. Record their attendance when they arrive.</p></div>
          {editable && <form onSubmit={addGuest} className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 text-sm font-medium text-gray-800">Visitor name<input required maxLength={120} value={guestName} onChange={event => setGuestName(event.target.value)} disabled={saving} className={`${inputClass} w-full text-gray-950`} /></label>
            <label className="min-w-48 flex-1 text-sm font-medium text-gray-800">Phone number (optional)<input type="tel" maxLength={32} value={guestPhone} onChange={event => setGuestPhone(event.target.value)} disabled={saving} placeholder="e.g. 0241234567" className={`${inputClass} w-full text-gray-950`} /></label>
            <button disabled={saving || guests.length>=200} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add first-time visitor</button>
          </form>}
          {guestError && <p role="alert" className="text-sm text-red-800">{guestError}</p>}
          <ul className="divide-y divide-gray-100">{(editable ? guests : comparison.guests).map(guest => <li key={guest.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold text-gray-950">{guest.name}</p><p className="text-sm text-gray-600">{guest.phone || 'No phone number'}</p></div>{editable && <button type="button" aria-label={`Remove ${guest.name} from projection`} disabled={saving} onClick={() => {setGuests(previous => previous.filter(item => item.id!==guest.id));if(!dirty)setDraftRevision(comparison.revision);setDirty(true);setMessage('');}} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Remove</button>}</li>)}</ul>
          {!(editable ? guests : comparison.guests).length && <p className="text-sm text-gray-600">No first-time visitors added to this projection.</p>}
          {dirty && editable && <p className="text-sm font-medium text-blue-900">Use Save projection above to save these changes.</p>}
        </section>
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex flex-wrap gap-3 p-5"><input aria-label="Search projected brethren" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search brethren by name…" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><select aria-label="Projection comparison filter" value={view} onChange={event => setView(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="all">All brethren</option><option value="projected">Projected</option><option value="present">Actually present</option><option value="projected-missing">Projected, no present record</option><option value="unexpected">Came without projection</option></select></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr><th className="px-5 py-3">Projected</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Actual attendance</th></tr></thead><tbody className="divide-y divide-gray-100">{visiblePeople.map(person => <tr key={person.id}><td className="px-5 py-4"><input type="checkbox" aria-label={`Project attendance for ${person.name}`} checked={person.projected} disabled={!editable || !person.rosterMember || Boolean(person.guestId) || saving} onChange={event => {setSelected(previous => {const next=new Set(previous);if(event.target.checked)next.add(person.id);else next.delete(person.id);return next;});if(!dirty)setDraftRevision(comparison.revision);setDirty(true);setMessage('');}} /></td><td className="px-5 py-4 font-semibold text-gray-950">{person.name}{person.guestId ? <span className="ml-2 text-xs font-normal text-blue-800">Projected first-time visitor</span> : !person.rosterMember && <span className="ml-2 text-xs font-normal text-gray-600">Visitor / not in roster</span>}</td><td className={`px-5 py-4 ${person.actual==='present' ? 'font-semibold text-green-800' : 'text-gray-600'}`}>{actualLabel(person.actual,future)}</td></tr>)}</tbody></table></div>{!visiblePeople.length && <p className="p-8 text-center text-gray-600">No brethren match this view.</p>}</section>
      </> : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[['Projections submitted',`${comparisons.filter(item => item.submitted).length} / ${comparisons.length}`],['Total projected',comparisons.reduce((sum,item) => sum+(item.projected || 0),0)],['Actual present',future ? 'Pending' : comparisons.reduce((sum,item) => sum+item.actual,0)]].map(([label,value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-600">{label}</p><p className="mt-1 text-2xl font-bold text-gray-950">{value}</p></div>)}</div>
        <section aria-label="Projected versus actual attendance graph" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-gray-950">Fellowship projections vs actual attendance</h3><p className="mt-1 text-sm text-gray-600">A missing projection is shown as “Not submitted,” rather than zero. {future ? 'Actual attendance is pending the service.' : 'Expand a fellowship below to see who came.'}</p><div style={{height:Math.max(250,comparisons.length*54)}} className="mt-5 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparisons} layout="vertical" accessibilityLayer margin={{left:0,right:20}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="fellowship" width={120} tick={{fontSize:12}}/><Tooltip/><Legend/><Bar dataKey="projected" name="Projected" fill="#2563eb"/><Bar dataKey="actual" name="Actual present" fill="#15803d"/></BarChart></ResponsiveContainer></div></section>
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><h3 className="p-5 font-bold text-gray-950">Breakdown by fellowship</h3><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{['Fellowship / people','Projected','Actual present','Projected who came','Projected, no present record','Came without projection'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{comparisons.map(item => <ComparisonRow key={item.fellowship} comparison={item} future={future}/>)}</tbody></table></div></section>
      </>}
      <p className="text-sm text-gray-600">“Not recorded” means there is no present/absent entry. A projected attendee without a present record is not automatically marked absent.</p>
    </>}
  </div>;
}
function ComparisonRow({comparison:item,future}:{comparison:ProjectionComparison;future:boolean}) {
  return <tr><td className="px-4 py-4 align-top"><details><summary className="cursor-pointer font-semibold text-blue-900">{item.fellowship}</summary><p className="mt-2 text-xs text-gray-600">{item.submitted ? `Saved by ${item.updatedBy || 'leader'}` : 'Not submitted'} · {item.locked ? 'Locked' : 'Open until Sunday 9 a.m.'}</p><ul className="mt-3 space-y-2">{item.people.map(person => <li key={person.id} className="text-xs text-gray-700"><span className="font-semibold">{person.name}</span>{person.guestId && ' (first-time visitor)'} · {person.projected ? 'Projected' : 'Not projected'} · {actualLabel(person.actual,future)}</li>)}</ul>{!item.people.length && <p className="mt-2 text-xs text-gray-600">No active brethren or attendance.</p>}</details></td><td className="px-4 py-4 align-top">{item.submitted ? item.projected : 'Not submitted'}</td><td className="px-4 py-4 align-top">{future ? 'Pending' : item.actual}</td><td className="px-4 py-4 align-top">{future ? 'Pending' : number(item.projectedCame)}</td><td className="px-4 py-4 align-top">{future ? 'Pending' : number(item.projectedNotPresent)}</td><td className="px-4 py-4 align-top">{future ? 'Pending' : number(item.unprojectedCame)}</td></tr>;
}
