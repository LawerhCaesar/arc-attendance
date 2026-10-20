import type { AttendanceRecord, Member } from './database';
import { normalizeDuplicatePhone } from './member-duplicates';

export type ReportingMember = Pick<Member, 'id' | 'name' | 'phone' | 'fellowship' | 'is_active' | 'merged_into_id'>;
type IdentityRow = Pick<AttendanceRecord, 'member_id' | 'name' | 'phone' | 'fellowship'>;
const nameKey = (name: string) => (name || '').trim().toLowerCase().split(/\s+/).sort().join(' ');
const identityKey = (person: { name: string; fellowship: string }) => JSON.stringify([nameKey(person.name), person.fellowship]);

/** Hide archived identities in reports without changing stored attendance.
 * Linked IDs win; ambiguous legacy contacts never hide an active namesake.
 */
export function excludeArchivedAttendance<T extends IdentityRow>(rows: T[], members: ReportingMember[]): T[] {
  const byId = new Map(members.filter(member => member.id).map(member => [member.id!, member]));
  const archived = (member: ReportingMember) => {
    const owner = member.merged_into_id ? byId.get(member.merged_into_id) : member;
    return owner?.is_active === false && !owner.merged_into_id;
  };
  const phones = new Map<string, ReportingMember[]>();
  const names = new Map<string, ReportingMember[]>();
  for (const member of members) {
    const phone = normalizeDuplicatePhone(member.phone);
    if (phone) phones.set(phone, [...(phones.get(phone) || []), member]);
    const key = identityKey(member);
    names.set(key, [...(names.get(key) || []), member]);
  }
  return rows.filter(row => {
    if (row.member_id) { const member = byId.get(row.member_id); return !member || !archived(member); }
    const phone = normalizeDuplicatePhone(row.phone);
    const candidates = phone ? phones.get(phone) || [] : names.get(identityKey(row)) || [];
    const named = candidates.filter(member => identityKey(member) === identityKey(row));
    const matches = named.length ? named : candidates;
    return !matches.length || !matches.every(archived);
  });
}
