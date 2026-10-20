import type { AttendanceRecord, Member } from './database';
import { nextBirthday } from './birthdays';
import { normalizeDuplicatePhone } from './member-duplicates';
import { excludeArchivedAttendance } from './archived-attendance';

export function fellowshipBirthdayDirectory(members: { id: string; name: string; birthday?: string | null }[], today: string) {
  return members.map(member => {
    const birthday = nextBirthday(member.birthday || '', today);
    return { id: member.id, name: member.name, month: birthday?.month ?? null,
      birthdayLabel: birthday?.display ?? null, daysUntil: birthday?.daysUntil ?? null,
      nextBirthday: birthday?.nextDate ?? null };
  }).sort((a, b) => (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity) || a.name.localeCompare(b.name));
}
export type FellowshipBirthday = ReturnType<typeof fellowshipBirthdayDirectory>[number];

export interface FellowshipHistoryMember {
  id: string;
  name: string;
  archived: boolean;
  history: { date: string; status: 'present' | 'absent' }[];
}
export interface FellowshipAttendanceReport {
  fellowship: string;
  today: string;
  members: FellowshipHistoryMember[];
  unlinkedRecords: number;
}
export type HistoryMemberInput = Pick<Member, 'id' | 'name' | 'phone' | 'fellowship' | 'is_active' | 'merged_into_id'>;
export type HistoryAttendanceInput = Pick<AttendanceRecord, 'id' | 'member_id' | 'name' | 'phone' | 'fellowship' | 'date' | 'attendanceDate' | 'attendanceStatus'>;
export function validServiceDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Linked IDs are authoritative. A legacy row must identify exactly one roster
 * member; ambiguous/shared contacts never inflate several members' totals.
 */
export function fellowshipAttendanceReport(members: HistoryMemberInput[], rows: HistoryAttendanceInput[], fellowship: string, today: string): FellowshipAttendanceReport {
  const roster = members.filter(member => member.id && member.fellowship === fellowship && member.is_active !== false && !member.merged_into_id);
  const byId = new Map(roster.map(member => [member.id!, member]));
  const phoneIndex = new Map<string, HistoryMemberInput[]>();
  const nameIndex = new Map<string, HistoryMemberInput[]>();
  const nameKey = (name: string) => name.trim().toLowerCase().split(/\s+/).sort().join(' ');
  const add = (index: Map<string, HistoryMemberInput[]>, key: string | null, member: HistoryMemberInput) => {
    if (key) index.set(key, [...(index.get(key) || []), member]);
  };
  for (const member of roster) {
    add(phoneIndex, normalizeDuplicatePhone(member.phone), member);
    add(nameIndex, nameKey(member.name), member);
  }
  const histories = new Map<string, Map<string, 'present' | 'absent'>>();
  let unlinkedRecords = 0;
  for (const row of excludeArchivedAttendance(rows, members)) {
    if (row.fellowship !== fellowship) continue;
    const date = row.attendanceDate || row.date;
    if (!validServiceDate(date) || date > today || !['', 'present', 'absent'].includes(row.attendanceStatus || '')) continue;
    let member = row.member_id ? byId.get(row.member_id) : undefined;
    if (!row.member_id) {
      const phone = normalizeDuplicatePhone(row.phone);
      const candidates = phone ? phoneIndex.get(phone) || [] : nameIndex.get(nameKey(row.name)) || [];
      if (candidates.length === 1) member = candidates[0];
      else if (phone && candidates.length > 1) {
        const named = candidates.filter(candidate => nameKey(candidate.name) === nameKey(row.name));
        if (named.length === 1) member = named[0];
      }
    }
    if (!member) { unlinkedRecords++; continue; }
    const history = histories.get(member.id!) || new Map<string, 'present' | 'absent'>();
    const status = row.attendanceStatus === 'absent' ? 'absent' : 'present';
    if (history.get(date) !== 'present') history.set(date, status);
    histories.set(member.id!, history);
  }
  return { fellowship, today, unlinkedRecords, members: roster.map(member => ({
    id: member.id!, name: member.name, archived: member.is_active === false,
    history: [...(histories.get(member.id!) || [])].map(([date, status]) => ({ date, status })).sort((a, b) => b.date.localeCompare(a.date)),
  })).sort((a, b) => a.name.localeCompare(b.name)) };
}
