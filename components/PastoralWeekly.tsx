'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { memberInformationIssues, type PastoralInsights, type CareSuggestion } from '@/lib/pastoral-insights';
import type { Member } from '@/lib/database';
import { careCounts, type CareTask } from '@/lib/care-followups';
import { dateInAccra } from '@/lib/birthdays';
import DismissibleBanner from './DismissibleBanner';
import MemberDetailsModal from './MemberDetailsModal';

interface Queue { tasks: CareTask[]; owners: { username: string; label: string }[]; username: string }
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const button = 'rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function PastoralWeekly({ assignedOnly = false, fellowshipCare = false, canEditMembers = false, onMemberSaved }: { assignedOnly?: boolean; fellowshipCare?: boolean; canEditMembers?: boolean; onMemberSaved?: () => void }) {
  const [briefExpanded, setBriefExpanded] = useState(true);
  const briefContentId = useId();
  const [insights, setInsights] = useState<PastoralInsights | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [weeklyError, setWeeklyError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberNotice, setMemberNotice] = useState('');
  const [editing, setEditing] = useState<CareTask | CareSuggestion | null>(null);
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState(dateInAccra());
  const [status, setStatus] = useState<CareTask['status']>('open');
  const [priority, setPriority] = useState<CareTask['priority']>('normal');
  const [outcome, setOutcome] = useState('');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(15);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    await Promise.all([
      assignedOnly ? Promise.resolve() : fetch('/api/pastoral/weekly', { cache: 'no-store' }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (current === requestId.current) { setInsights(result); setWeeklyError(''); }
      }).catch(() => { if (current === requestId.current) setWeeklyError('Weekly insights could not be refreshed. Any previous figures below may be outdated.'); }),
      fetch('/api/pastoral/followups', { cache: 'no-store' }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (current === requestId.current) { setQueue(result); setQueueError(''); }
      }).catch(() => { if (current === requestId.current) { setQueue(null); setQueueError('Follow-ups are unavailable. Retry, or ask an administrator to check the pastoral follow-ups migration.'); } }),
    ]);
    if (current === requestId.current) setLoading(false);
  }, [assignedOnly]);
  useEffect(() => { load(); }, [load]);
  const memberSaved = (member: Member) => {
    const issues = memberInformationIssues(member);
    setInsights(current => current ? { ...current, dataQuality: current.dataQuality
      .map(person => person.id === member.id ? { ...person, name: member.name, fellowship: member.fellowship, issues } : person)
      .filter(person => person.issues.length > 0) } : current);
    setEditingMemberId(null);
    setMemberNotice(`${member.name}'s details were updated.`);
    void load();
    onMemberSaved?.();
  };
  const edit = (person: CareTask | CareSuggestion) => {
    setEditing(person); setError('');
    const task = 'id' in person ? person : null;
    setOwner(task?.owner || queue?.username || ''); setDue(task?.due_date || dateInAccra());
    setStatus(task?.status || 'open'); setPriority(task?.priority || 'normal'); setOutcome(task?.outcome || '');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editing) return;
    setBusy(true); setError('');
    try {
      const existing = 'id' in editing;
      const response = await fetch('/api/pastoral/followups', {
        method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, due_date: due, status, priority, outcome,
          ...(existing ? { id: editing.id, updated_at: editing.updated_at } : { person_ref: editing.personRef, category: editing.category }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save follow-up.');
      setEditing(null); await load();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const today = dateInAccra();
  const counts = queue ? careCounts(queue.tasks, today) : null;
  const matches = (name: string, fellowship: string) => `${name} ${fellowship}`.toLowerCase().includes(search.toLowerCase());
  const tasks = (queue?.tasks || []).filter(task => matches(task.name, task.fellowship) &&
    (filter === 'all' || (filter === 'mine' ? task.owner === queue?.username && ['open', 'in_progress'].includes(task.status) :
      filter === 'open' ? ['open', 'in_progress'].includes(task.status) : task.status === filter)));
  const suggestions = (insights?.suggestions || []).filter(person => matches(person.name, person.fellowship) &&
    !queue?.tasks.some(task => task.person_ref === person.personRef && task.category === person.category &&
      (['open', 'in_progress'].includes(task.status) || task.updated_at.slice(0, 10) >= (person.category === 'birthday' ? today : insights!.latestDate || today))));
  return <section className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 text-gray-900 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold text-gray-950">{assignedOnly ? 'My follow-ups' : <button type="button" aria-expanded={briefExpanded} aria-controls={briefContentId} onClick={() => setBriefExpanded(value => !value)} className="flex items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><span aria-hidden="true" className="text-base">{briefExpanded ? '▼' : '▶'}</span>{fellowshipCare ? 'Fellowship Care Centre' : 'Pastor’s weekly brief'}</button>}</h2>
        {!assignedOnly && <p className="mt-1 text-sm text-gray-600">Latest recorded service: {insights?.latestDate || 'Not available'} · Care priorities as of {insights?.asOf || today}. Independent of the period filter below.</p>}</div>
      <button type="button" onClick={load} disabled={loading || busy} className={button}>{loading ? 'Refreshing…' : 'Refresh brief'}</button>
    </div>
    <div id={briefContentId} hidden={!assignedOnly && !briefExpanded} className="space-y-5">
    {weeklyError && <p role="alert" className="text-sm text-red-800">{weeklyError}</p>}
    {insights && <>
      {(insights.daysSinceService === null || insights.daysSinceService > 7) && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">No recent service data: attendance-based care suggestions may be outdated. Confirm service records before contacting members.</p>}
      <p className="text-xs text-gray-600">Figures reflect recorded attendance, not a confirmed headcount. An incomplete service can affect absence alerts. Follow-ups are suggestions—not proof that someone needs intervention.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Latest attendance', insights.latestAttendance, insights.change === null ? 'No prior service comparison' : `${insights.change >= 0 ? '+' : ''}${insights.change} vs ${insights.previousDate}`],
          ['New visitors', insights.newVisitors, `${insights.returningVisitors} previous visitors returned`],
          ['Visitor return rate', insights.retention.rate === null ? '—' : `${insights.retention.rate}%`, `${insights.retention.returned}/${insights.retention.eligible} visitors returned · first visits in last 28 days with a later service available`],
          ['Member consistency', insights.consistency.rate === null ? '—' : `${insights.consistency.rate}%`, `${insights.consistency.consistent}/${insights.consistency.eligible} eligible members attended at least 3 of the last 4 recorded services`],
        ].map(([label, value, detail]) => <div key={label} className="rounded-xl bg-white p-4 shadow-sm"><h3 className="text-sm text-gray-600">{label}</h3><p className="my-1 text-2xl font-bold text-blue-950">{value}</p><p className="text-xs text-gray-600">{detail}</p></div>)}
      </div>
      <details className="rounded-xl bg-white p-4"><summary className="cursor-pointer font-semibold text-gray-900">Recent services and returning members</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h3 className="text-sm font-semibold">Last eight recorded services</h3><table className="mt-2 w-full text-left text-sm"><thead><tr><th>Service date</th><th>Present</th></tr></thead><tbody>{insights.trend.map(row => <tr key={row.date}><td className="py-1">{row.date}</td><td>{row.attendance}</td></tr>)}</tbody></table></div>
          <div><h3 className="text-sm font-semibold">Welcome back · {insights.returnedMembers.length}</h3><p className="text-xs text-gray-600">Present at the latest service after at least two recorded absences.</p>{insights.returnedMembers.length ? insights.returnedMembers.map((person, i) => <p key={i} className="mt-2 text-sm">{person.name} · {person.fellowship}</p>) : <p className="mt-2 text-sm text-gray-600">None identified.</p>}</div></div>
      </details>
      <details className="rounded-xl bg-white p-4">
        <summary className="cursor-pointer font-semibold text-gray-900">Member information to complete · {insights.dataQuality.length} {insights.dataQuality.length === 1 ? 'person' : 'people'}</summary>
        <p className="my-2 text-sm text-gray-600">Each person is counted once even when multiple details are missing.{canEditMembers ? ' Select Edit details to update a member here.' : ' Ask a staff member with Member Roster access to update these details.'}</p>
        {memberNotice && <DismissibleBanner onDismiss={() => setMemberNotice('')} className="my-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{memberNotice}</DismissibleBanner>}
        <div className="max-h-80 overflow-y-auto">
          {insights.dataQuality.map((person, i) => <div key={person.id || i} className="flex items-center justify-between gap-4 border-t border-gray-200 py-3 text-sm">
            <div className="min-w-0"><p className="text-gray-700"><span className="font-semibold text-gray-950">{person.name}</span> · {person.fellowship || 'Unassigned'}</p><p className="mt-1 text-sm text-amber-800">{person.issues.join(' · ')}</p></div>
            {canEditMembers && person.id && <button type="button" aria-label={`Edit details for ${person.name}`} onClick={() => { setMemberNotice(''); setEditingMemberId(person.id!); }} className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500">Edit details</button>}
          </div>)}
          {!insights.dataQuality.length && <p className="py-3 text-sm text-gray-700">All member information is complete.</p>}
        </div>
      </details>
    </>}
    <div className="rounded-xl bg-white p-4">
      <h3 className="text-lg font-bold text-gray-900">Assigned follow-ups</h3>
      <p className="mt-1 text-xs text-gray-600">Visible to Overview staff and the assigned owner with My Follow-ups access. Use brief operational outcomes only—no confidential counselling or medical notes. Assignment does not send a message.</p>
      {queueError && <p role="alert" className="mt-3 text-sm text-red-800">{queueError}</p>}
      {counts && <p className="my-3 text-sm text-gray-700">{counts.open} open · <span className="font-semibold text-red-700">{counts.overdue} overdue</span> · {counts.dueToday} due today · {counts.completed} completed</p>}
      <div className="my-3 flex flex-wrap gap-2"><input aria-label="Search care people" placeholder="Search name or fellowship…" value={search} onChange={event => { setSearch(event.target.value); setLimit(15); }} className={`${input} sm:max-w-xs`} /><select aria-label="Filter follow-ups" value={filter} onChange={event => { setFilter(event.target.value); setLimit(15); }} className={`${input} sm:max-w-xs`}><option value="open">Open follow-ups</option><option value="mine">My open follow-ups</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option><option value="all">All follow-ups</option></select></div>
      {queue && <div className="max-h-96 space-y-2 overflow-y-auto">{tasks.slice(0, limit).map(task => <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3"><div className="min-w-0"><p className="font-semibold text-gray-900">{task.name} {task.priority === 'high' && <span className="text-xs text-red-700">High priority</span>}</p><p className="text-xs text-gray-600">{task.fellowship} · {task.category} · {task.owner} · Due {task.due_date} · {task.status.replace('_', ' ')}</p>{['open', 'in_progress'].includes(task.status) && task.due_date < today && <span className="text-xs font-bold text-red-700">Overdue</span>}<p className="mt-1 max-w-xl whitespace-pre-wrap break-words text-sm text-gray-700">{task.outcome || task.reason}</p></div><button type="button" onClick={() => edit(task)} disabled={busy} className={button}>Update</button></div>)}{!tasks.length && <p className="py-3 text-sm text-gray-600">No follow-ups match this view.</p>}</div>}
    </div>
    {!assignedOnly && <details className="rounded-xl bg-white p-4" open>
      <summary className="cursor-pointer font-semibold text-gray-900">Suggested care actions · {suggestions.length}</summary>
      <p className="my-2 text-xs text-gray-600">Repeated absences, recent visitors without a return, and birthdays within seven days. Assigning a task does not claim that contact has been made.</p>
      <div className="max-h-96 space-y-2 overflow-y-auto">{suggestions.slice(0, limit).map(person => <div key={`${person.personRef}:${person.category}`} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3"><div><p className="font-semibold text-gray-900">{person.name}</p><p className="text-xs text-gray-600">{person.fellowship} · {person.reason}</p><details className="mt-2 text-xs text-gray-700"><summary className="cursor-pointer font-semibold">Attendance history</summary><p>Latest 12 recorded services for this person. Missing records are not confirmed absences.</p>{insights?.timelines[person.personRef]?.map(row => <p key={row.date} className="mt-1">{row.date} · {row.status} · {row.fellowship}</p>)}</details></div><button type="button" disabled={!queue || busy} onClick={() => edit(person)} className={button}>Assign</button></div>)}{insights && !suggestions.length && <p className="text-sm text-gray-600">No unassigned suggestions match this view.</p>}</div>
    </details>}
    {(tasks.length > limit || suggestions.length > limit) && <button type="button" onClick={() => setLimit(value => value + 25)} className="text-sm font-semibold text-blue-800 underline">Show more</button>}
    {editingMemberId && canEditMembers && <MemberDetailsModal key={editingMemberId} memberId={editingMemberId} onClose={() => setEditingMemberId(null)} onSaved={memberSaved} />}
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="care-editor-title"><form onSubmit={save} className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <h3 id="care-editor-title" className="text-xl font-bold text-gray-900">Follow up: {editing.name}</h3><p className="text-sm text-gray-600">{editing.reason}</p>
      <label className="block text-sm text-gray-700">Owner<select required value={owner} onChange={event => setOwner(event.target.value)} className={input}><option value="">Choose staff member</option>{queue?.owners.map(item => <option key={item.username} value={item.username}>{item.label} ({item.username})</option>)}</select></label>
      <label className="block text-sm text-gray-700">Due date<input required type="date" value={due} onChange={event => setDue(event.target.value)} className={input} /></label>
      <label className="block text-sm text-gray-700">Priority<select value={priority} onChange={event => setPriority(event.target.value as CareTask['priority'])} className={input}><option value="normal">Normal</option><option value="high">High</option></select></label>
      {'id' in editing && <label className="block text-sm text-gray-700">Status<select value={status} onChange={event => setStatus(event.target.value as CareTask['status'])} className={input}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option></select></label>}
      <label className="block text-sm text-gray-700">Outcome / next step<textarea maxLength={1000} required={status === 'completed' || status === 'dismissed'} value={outcome} onChange={event => setOutcome(event.target.value)} className={input} placeholder="E.g. Called; agreed to check in next week. No sensitive personal notes." /></label>
      {error && <DismissibleBanner role="alert" onDismiss={() => setError('')} className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</DismissibleBanner>}
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-gray-700">Cancel</button><button disabled={busy} className={button}>{busy ? 'Saving…' : 'Save follow-up'}</button></div>
    </form></div>}
    </div>
  </section>;
}
