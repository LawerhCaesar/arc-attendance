'use client';
import { attendanceColorFilters, attendanceStyles } from '@/lib/attendance-presentation';
import type { RosterAttendanceSummary } from '@/lib/roster-attendance';
import type { RosterColorFilter } from '@/lib/roster-view';

export function MemberAttendanceBadge({memberId,summary}:{memberId?:string;summary?:RosterAttendanceSummary|null}) {
  const status = memberId ? summary?.members[memberId] : undefined;
  const style = attendanceStyles[status?.color || 'unavailable'];
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
    {status?.attended != null ? `${status.attended}/${summary?.serviceDates.length} · ${style.label}` : status?.color==='archived' ? 'Archived · excluded' : summary && !summary.serviceDates.length ? 'No services yet' : 'Unavailable'}
  </span>;
}
export function AttendanceColorGuide({summary,value,onChange}:{summary?:RosterAttendanceSummary|null;value?:RosterColorFilter;onChange?:(value:RosterColorFilter)=>void}) {
  return <section aria-label="Attendance color guide" className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
    <h3 className="font-semibold text-gray-950">Attendance consistency · last 8 services</h3>
    <div role="group" aria-label="Filter by attendance color" className="flex flex-wrap gap-2 text-xs font-semibold">{attendanceColorFilters.filter(filter=>onChange||filter.key!=='all').map(filter=>onChange ?
      <button key={filter.key} type="button" aria-pressed={value===filter.key} onClick={()=>onChange(value===filter.key?'all':filter.key)} className={`rounded-full border px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${filter.style} ${value===filter.key?'ring-2 ring-blue-600 ring-offset-2':''}`}>{filter.label}</button> :
      <span key={filter.key} className={`rounded-full border px-3 py-1.5 ${filter.style}`}>{filter.label}</span>)}</div>
    <p className="text-xs text-gray-600">Colors use the latest eight recorded church service dates, independently of the report’s date filters. {summary?.serviceDates.length ? `${summary.serviceDates.length} service${summary.serviceDates.length===1?'':'s'}: ${summary.serviceDates.at(-1)} to ${summary.serviceDates[0]}.` : summary ? 'No recorded services yet.' : 'Attendance colors unavailable.'} Archived brethren are excluded.</p>
  </section>;
}
