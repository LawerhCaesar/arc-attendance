import type { AttendanceRecord, Member } from './database';
import { reconcileFellowshipAttendance } from './fellowship-attendance';
import { excludeArchivedAttendance } from './archived-attendance';
import { validServiceDate } from './fellowship-insights';
import { MemberInputError } from './member-scope';

export interface SundayProjection {
  service_date: string; fellowship: string; projected_member_ids: string[];
  revision: number; submitted_at: string | null; updated_at: string; updated_by: string | null;
}
export interface ProjectionPerson { id: string; name: string; projected: boolean; actual: 'present' | 'absent' | 'not_recorded'; rosterMember: boolean }
export function upcomingSunday(today: string) { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + (7 - date.getUTCDay()) % 7); return date.toISOString().slice(0,10); }
export function projectionSunday(value: string) {
  if (!validServiceDate(value) || new Date(`${value}T00:00:00Z`).getUTCDay() !== 0) throw new MemberInputError('Choose a valid Sunday service date.');
  return value;
}
export function projectionLocked(serviceDate: string, now = new Date()) { return now.getTime() >= Date.parse(`${serviceDate}T12:00:00Z`); }
export function compareSundayProjection(members: Member[], rows: AttendanceRecord[], projection: SundayProjection | null, fellowship: string, serviceDate: string, today: string, now = new Date()) {
  const roster = members.filter(member => member.id && member.fellowship === fellowship && member.is_active !== false && !member.merged_into_id);
  const selected = new Set(projection?.projected_member_ids || []);
  const serviceRows = excludeArchivedAttendance(rows, members).filter(row => row.fellowship === fellowship &&
    (row.attendanceDate || row.date) === serviceDate && serviceDate <= today);
  const attendance = reconcileFellowshipAttendance(serviceRows, roster);
  const actualById = new Map(attendance.map(row => [row.personId, row.attendanceStatus === 'absent' ? 'absent' as const : 'present' as const]));
  const rosterIds = new Set(roster.map(member => `member:${member.id}`));
  const people: ProjectionPerson[] = roster.map(member => ({ id: member.id!, name: member.name, projected: selected.has(member.id!),
    actual: actualById.get(`member:${member.id}`) || 'not_recorded', rosterMember: true }));
  attendance.filter(row => !rosterIds.has(row.personId) && row.attendanceStatus === 'present').forEach((row, index) => {
    people.push({ id: `attendance:${row.id || index}`, name: row.name, projected: false, actual: 'present', rosterMember: false });
  });
  people.sort((a,b) => a.name.localeCompare(b.name));
  const projected = people.filter(person => person.projected).length;
  const actual = people.filter(person => person.actual === 'present').length;
  const projectedCame = people.filter(person => person.projected && person.actual === 'present').length;
  const submitted = Boolean(projection?.submitted_at);
  return { fellowship, submitted, revision: projection?.revision || 0, updatedAt: projection?.submitted_at ? projection.updated_at : null,
    updatedBy: projection?.submitted_at ? projection.updated_by : null,
    locked: projectionLocked(serviceDate,now),
    projected: submitted ? projected : null, actual, projectedCame: submitted ? projectedCame : null,
    projectedNotPresent: submitted ? projected - projectedCame : null, unprojectedCame: submitted ? actual - projectedCame : null,
    people };
}
export type ProjectionComparison = ReturnType<typeof compareSundayProjection>;
export interface ProjectionReport { serviceDate: string; today: string; canEdit: boolean; fellowshipScope: string | null; comparisons: ProjectionComparison[] }
