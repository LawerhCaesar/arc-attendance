import type { AttendanceRecord, Member } from './database';

export const normalizePhone = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};
const normalizeName = (value?: string) => (value || '').toLowerCase().trim().split(/\s+/).sort().join(' ');
const normalizeText = (value?: string) => (value || '').toLowerCase().trim().replace(/\s+/g, ' ');

export function matchesRosterMember(record: Pick<AttendanceRecord, 'name' | 'phone' | 'fellowship' | 'member_id'>, member: Pick<Member, 'id' | 'name' | 'phone' | 'fellowship'>) {
  if (record.member_id) return record.member_id === member.id;
  const a = normalizePhone(record.phone);
  const b = normalizePhone(member.phone);
  if (a.length >= 7 && b.length >= 7) return a === b;
  return normalizeName(record.name) === normalizeName(member.name) &&
    normalizeText(record.fellowship) === normalizeText(member.fellowship);
}

/** Build once when loading a complete roster instead of comparing every member
 * against every attendance row on each dashboard calculation.
 */
export function indexAttendanceByMember<T extends Pick<AttendanceRecord, 'name' | 'phone' | 'fellowship' | 'member_id'>>(rows: T[]) {
  const index = new Map<string, T[]>();
  const nameKey = (person: { name: string; fellowship: string }) => `name:${normalizeName(person.name)}:${normalizeText(person.fellowship)}`;
  const add = (key: string, row: T) => {
    const values = index.get(key) || [];
    values.push(row);
    index.set(key, values);
  };
  for (const row of rows) {
    if (row.member_id) { add(`id:${row.member_id}`, row); continue; }
    add(nameKey(row), row);
    const phone = normalizePhone(row.phone);
    if (phone.length >= 7) add(`phone:${phone}`, row);
  }
  return (member: Pick<Member, 'id' | 'name' | 'phone' | 'fellowship'>): T[] => {
    const phone = normalizePhone(member.phone);
    return Array.from(new Set([
      ...(index.get(`id:${member.id}`) || []),
      ...(index.get(nameKey(member)) || []),
      ...(phone.length >= 7 ? index.get(`phone:${phone}`) || [] : []),
    ])).filter(row => matchesRosterMember(row, member));
  };
}

/** Minimal check-in status for the active roster, restricted to one service. */
export function presentRosterMemberIds(rows: AttendanceRecord[], members: Member[], serviceDate: string): string[] {
  const presentForMember = indexAttendanceByMember(rows.filter(row =>
    (row.attendanceDate || row.date) === serviceDate &&
    (!row.attendanceStatus || row.attendanceStatus === 'present')
  ));
  return members.filter(member => member.id && member.is_active !== false && presentForMember(member).length > 0)
    .map(member => member.id!);
}

/** Preserve stored rows for audit while exposing one attendance per linked
 * member/service. A present entry wins over an absent duplicate.
 */
export function consolidateLinkedAttendance<T extends AttendanceRecord>(rows: T[]): T[] {
  const result: T[] = [];
  const indices = new Map<string, number>();
  for (const row of rows) {
    if (!row.member_id) { result.push(row); continue; }
    const key = `${row.member_id}:${row.attendanceDate || row.date}`;
    const index = indices.get(key);
    if (index === undefined) {
      indices.set(key, result.length);
      result.push({ ...row });
      continue;
    }
    const prior = result[index];
    const present = [prior, row].some(item => !item.attendanceStatus || item.attendanceStatus === 'present');
    result[index] = {
      ...prior,
      attendanceStatus: present ? 'present' : prior.attendanceStatus,
      firstTimer: [prior, row].some(item => ['yes', 'true', '1'].includes(String(item.firstTimer).toLowerCase())) ? 'Yes' : 'No',
      birthday: prior.birthday || row.birthday,
      location: prior.location || row.location,
    };
  }
  return result;
}
