import type { AttendanceRecord, Member } from './database';
import { reconcileFellowshipAttendance } from './fellowship-attendance';
import { excludeArchivedAttendance } from './archived-attendance';
import { validServiceDate } from './fellowship-insights';
import { MemberInputError, memberUuid } from './member-scope';
import { normalizeDuplicatePhone } from './member-duplicates';

export interface ProjectionGuest { id: string; name: string; phone: string }
export function parseProjectionGuests(value: unknown): ProjectionGuest[] {
  if (!Array.isArray(value) || value.length > 200) throw new MemberInputError('Add up to 200 first-time visitors per projection.');
  const ids = new Set<string>(); const contacts = new Set<string>();
  return value.map(guest => {
    if (!guest || typeof guest !== 'object' || typeof guest.id !== 'string' || !memberUuid.test(guest.id) ||
      typeof guest.name !== 'string' || !guest.name.trim() || guest.name.trim().length > 120 ||
      typeof guest.phone !== 'string' || guest.phone.length > 32) throw new MemberInputError('Enter a name and valid optional phone number for each first-time visitor.');
    const phone = normalizeDuplicatePhone(guest.phone);
    if (guest.phone.trim() && !phone) throw new MemberInputError(`Enter a valid phone number for ${guest.name.trim()}.`);
    const key = phone || `name:${guest.name.trim().toLowerCase().replace(/\s+/g,' ')}`;
    if (ids.has(guest.id.toLowerCase()) || contacts.has(key)) throw new MemberInputError('This first-time visitor is already included in the projection.');
    ids.add(guest.id.toLowerCase()); contacts.add(key);
    return {id:guest.id.toLowerCase(),name:guest.name.trim(),phone:phone ? `+${phone}` : ''};
  });
}

export interface SundayProjection {
  service_date: string; fellowship: string; projected_member_ids: string[];
  projected_guests?: ProjectionGuest[];
  revision: number; submitted_at: string | null; updated_at: string; updated_by: string | null;
}
export interface ProjectionPerson { id: string; name: string; phone: string; projected: boolean; actual: 'present' | 'absent' | 'not_recorded'; rosterMember: boolean; guestId?: string }
const nameKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g,' ').split(' ').sort().join(' ');
/** Match only unique contacts or unambiguous full names, and never count an arrival twice. */
export function includeProjectionGuests(basePeople: ProjectionPerson[], guests: ProjectionGuest[]): ProjectionPerson[] {
  const people = basePeople.map(person => ({...person}));
  const claimed = new Set<string>();
  for (const guest of guests) {
    const phone = normalizeDuplicatePhone(guest.phone);
    let matches = phone ? basePeople.filter(person => normalizeDuplicatePhone(person.phone) === phone) : [];
    if (!matches.length) {
      matches = basePeople.filter(person => nameKey(person.name) === nameKey(guest.name) && (!phone || !normalizeDuplicatePhone(person.phone)));
      if (guests.filter(item => nameKey(item.name) === nameKey(guest.name)).length !== 1) matches = [];
    }
    if (matches.length === 1 && !claimed.has(matches[0].id)) {
      const person = people.find(item => item.id === matches[0].id)!;
      person.projected = true; person.guestId = guest.id; claimed.add(person.id);
    } else {
      people.push({id:`guest:${guest.id}`,name:guest.name,phone:guest.phone,projected:true,actual:'not_recorded',rosterMember:false,guestId:guest.id});
    }
  }
  return people.sort((a,b) => a.name.localeCompare(b.name));
}
export function upcomingSunday(today: string) { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + (7 - date.getUTCDay()) % 7); return date.toISOString().slice(0,10); }
export function projectionSunday(value: string) {
  if (!validServiceDate(value) || new Date(`${value}T00:00:00Z`).getUTCDay() !== 0) throw new MemberInputError('Choose a valid Sunday service date.');
  return value;
}
export function projectionLocked(serviceDate: string, now = new Date()) { return now.getTime() >= Date.parse(`${serviceDate}T09:00:00Z`); }
export function compareSundayProjection(members: Member[], rows: AttendanceRecord[], projection: SundayProjection | null, fellowship: string, serviceDate: string, today: string, now = new Date()) {
  const roster = members.filter(member => member.id && member.fellowship === fellowship && member.is_active !== false && !member.merged_into_id);
  const selected = new Set(projection?.projected_member_ids || []);
  const serviceRows = excludeArchivedAttendance(rows, members).filter(row => row.fellowship === fellowship &&
    (row.attendanceDate || row.date) === serviceDate && serviceDate <= today);
  const attendance = reconcileFellowshipAttendance(serviceRows, roster);
  const actualById = new Map(attendance.map(row => [row.personId, row.attendanceStatus === 'absent' ? 'absent' as const : 'present' as const]));
  const rosterIds = new Set(roster.map(member => `member:${member.id}`));
  const basePeople: ProjectionPerson[] = roster.map(member => ({ id: member.id!, name: member.name, phone:member.phone || '', projected: selected.has(member.id!),
    actual: actualById.get(`member:${member.id}`) || 'not_recorded', rosterMember: true }));
  attendance.filter(row => !rosterIds.has(row.personId)).forEach((row, index) => {
    basePeople.push({ id: `attendance:${row.id || index}`, name: row.name, phone:row.phone || '', projected: false, actual: row.attendanceStatus === 'absent' ? 'absent' : 'present', rosterMember: false });
  });
  const guests = (projection?.projected_guests || []).filter(guest => {
    const matches = (member: Member) => {
      const phone = normalizeDuplicatePhone(guest.phone);
      return phone ? phone === normalizeDuplicatePhone(member.phone) : nameKey(guest.name) === nameKey(member.name);
    };
    return roster.some(matches) || !members.some(member => member.fellowship === fellowship && member.is_active === false && !member.merged_into_id && matches(member));
  });
  const people = includeProjectionGuests(basePeople,guests);
  const projected = people.filter(person => person.projected).length;
  const actual = people.filter(person => person.actual === 'present').length;
  const projectedCame = people.filter(person => person.projected && person.actual === 'present').length;
  const submitted = Boolean(projection?.submitted_at);
  return { fellowship, submitted, revision: projection?.revision || 0, updatedAt: projection?.submitted_at ? projection.updated_at : null,
    updatedBy: projection?.submitted_at ? projection.updated_by : null,
    locked: projectionLocked(serviceDate,now),
    projected: submitted ? projected : null, actual, projectedCame: submitted ? projectedCame : null,
    projectedNotPresent: submitted ? projected - projectedCame : null, unprojectedCame: submitted ? actual - projectedCame : null,
    people, basePeople, guests };
}
export type ProjectionComparison = ReturnType<typeof compareSundayProjection>;
export interface ProjectionReport { serviceDate: string; today: string; canEdit: boolean; fellowshipScope: string | null; comparisons: ProjectionComparison[] }
