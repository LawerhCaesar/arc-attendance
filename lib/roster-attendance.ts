import { fellowshipAttendanceReport, validServiceDate, type HistoryAttendanceInput, type HistoryMemberInput } from './fellowship-insights';

export type RosterAttendanceColor = 'green' | 'yellow' | 'red' | 'unavailable' | 'archived';
export interface RosterMemberAttendance { attended: number | null; color: RosterAttendanceColor }
export interface RosterAttendanceSummary {
  serviceDates: string[];
  members: Record<string, RosterMemberAttendance>;
}
export type ServiceCalendarRow = Pick<HistoryAttendanceInput, 'date' | 'attendanceDate' | 'attendanceStatus'>;

/** One common service window, with one present count per member/service.
 * Reuse the history report's linked-ID precedence and legacy identity checks.
 */
export function rosterAttendanceSummary(members: HistoryMemberInput[], rows: HistoryAttendanceInput[], calendar: ServiceCalendarRow[], today: string): RosterAttendanceSummary {
  const serviceDates = [...new Set(calendar.filter(row => ['', 'present', 'absent'].includes(row.attendanceStatus || ''))
    .map(row => row.attendanceDate || row.date).filter(date => validServiceDate(date) && date <= today))].sort().reverse().slice(0,8);
  const window = new Set(serviceDates);
  const recent = rows.filter(row => window.has(row.attendanceDate || row.date));
  const counts = new Map<string, number>();
  for (const fellowship of new Set(members.map(member => member.fellowship))) {
    const report = fellowshipAttendanceReport(members, recent, fellowship, today);
    for (const member of report.members) counts.set(member.id, member.history.filter(entry => entry.status === 'present').length);
  }
  return {serviceDates, members: Object.fromEntries(members.filter(member => member.id && !member.merged_into_id).map(member => {
    const attended = counts.get(member.id!) || 0;
    return [member.id!, member.is_active === false ? {attended:null,color:'archived'} : !serviceDates.length ? {attended:null,color:'unavailable'} :
      {attended,color:attended >= 4 ? 'green' : attended >= 1 ? 'yellow' : 'red'}];
  }))};
}
