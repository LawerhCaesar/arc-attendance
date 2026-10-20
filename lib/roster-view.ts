import { nextBirthday } from './birthdays';
import { normalizeDuplicatePhone } from './member-duplicates';
import type { RosterAttendanceColor, RosterAttendanceSummary } from './roster-attendance';

export type RosterSortKey = 'name' | 'attendance' | 'phone' | 'fellowship' | 'designation' | 'birthday' | 'location';
export type RosterColorFilter = 'all' | 'green' | 'yellow' | 'red' | 'gray';
interface RosterMember {
  id: string; name: string; phone: string; fellowship: string; designation: string;
  birthday: string; location: string; is_active?: boolean;
}
export function rosterMemberColor(member: Pick<RosterMember,'id'|'is_active'>, summary: RosterAttendanceSummary | null): RosterAttendanceColor {
  return member.is_active === false ? 'archived' : summary?.members[member.id]?.color || 'unavailable';
}
export function matchesRosterColor(member: Pick<RosterMember,'id'|'is_active'>, summary: RosterAttendanceSummary | null, filter: RosterColorFilter) {
  const color = rosterMemberColor(member,summary);
  return filter === 'all' || (filter === 'gray' ? color === 'archived' || color === 'unavailable' : color === filter);
}
const textOrder = new Intl.Collator('en',{numeric:true,sensitivity:'base'});
/** Attendance descending gives green, yellow, red, then neutral rows.
 * Missing values stay last in either direction; names break ties consistently.
 */
export function sortRosterMembers<T extends RosterMember>(members: T[], summary: RosterAttendanceSummary | null, key: RosterSortKey, direction: 'asc'|'desc'): T[] {
  const value = (member: T): string | number | null => {
    if (key === 'attendance') return ['archived','unavailable'].includes(rosterMemberColor(member,summary)) ? null : summary?.members[member.id]?.attended ?? null;
    if (key === 'birthday') {
      const birthday = nextBirthday(member.birthday || '', '2000-01-01');
      return birthday ? birthday.month * 100 + birthday.day : null;
    }
    const text = (member[key] || '').trim();
    return text ? key === 'phone' ? normalizeDuplicatePhone(text) || text : text : null;
  };
  const values = new Map(members.map(member => [member.id,value(member)]));
  return [...members].sort((a,b) => {
    const left = values.get(a.id)!, right = values.get(b.id)!;
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const compared = left === null || right === null ? 0 : typeof left === 'number' && typeof right === 'number' ? left-right : textOrder.compare(String(left),String(right));
    return compared * (direction === 'asc' ? 1 : -1) || textOrder.compare(a.name,b.name) || a.id.localeCompare(b.id);
  });
}
