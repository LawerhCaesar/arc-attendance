import type { AttendanceRecord, Member } from './database';
import { normalizePhone } from './attendance-identity';
import { FELLOWSHIPS } from './fellowships';

const text = (value: string) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const name = (value: string) => text(value).split(' ').sort().join(' ');
const fellowship = (value: string) => {
  const key = text(value);
  if (['tsalach', 'hsm'].includes(key)) return 'Shalach';
  return FELLOWSHIPS.find(item => text(item) === key) || key || 'Unassigned';
};
const present = (row: AttendanceRecord) => !row.attendanceStatus || row.attendanceStatus === 'present';

/** Reporting only: one person per service; no stored records are merged/deleted.
 * Ambiguous identities stay separate. Distinct member IDs never collapse.
 */
export function reconcileFellowshipAttendance(rows: AttendanceRecord[], members: Member[]) {
  const aliases = new Map<string, Set<string>>();
  const keys = (person: { name: string; phone: string; fellowship: string }) => {
    const phone = normalizePhone(person.phone);
    return {
      contact: phone.length >= 7 ? JSON.stringify([name(person.name), phone]) : '',
      name: JSON.stringify([name(person.name), fellowship(person.fellowship)]),
    };
  };
  const add = (key: string, id: string) => {
    if (!key) return;
    const ids = aliases.get(key) || new Set<string>();
    ids.add(id);
    aliases.set(key, ids);
  };
  const unique = (key: string) => aliases.get(key)?.size === 1 ? [...aliases.get(key)!][0] : undefined;
  for (const person of [...members.map(member => ({ ...member, member_id: member.id })), ...rows]) {
    if (!person.member_id || !person.name?.trim()) continue;
    const key = keys(person);
    if (key.contact) add(`contact:${key.contact}`, `member:${person.member_id}`);
    add(`name:${key.name}`, `member:${person.member_id}`);
  }
  const identities = rows.map((row, index) => {
    if (row.member_id) return `member:${row.member_id}`;
    if (!row.name?.trim()) return `unknown:${row.id || index}`;
    const key = keys(row);
    if (key.contact) {
      const id = unique(`contact:${key.contact}`) || `contact:${key.contact}`;
      add(`name:${key.name}`, id);
      return id;
    }
    return '';
  });
  const reconciled = new Map<string, AttendanceRecord & { personId: string }>();
  rows.forEach((row, index) => {
    const date = row.attendanceDate || row.date;
    if (!date) return;
    const key = keys(row);
    const personId = identities[index] || unique(`name:${key.name}`) || `name:${key.name}`;
    const group = JSON.stringify([personId, date]);
    const old = reconciled.get(group);
    // Present evidence wins over an overlapping absent entry. For conflicting
    // fellowships, use the latest present record (or latest absent if none).
    const stamp = (record: AttendanceRecord) => new Date(record.createdAt || `${record.date}T00:00:00Z`).getTime() || 0;
    const preferred = !old || (present(row) && !present(old)) ||
      (present(row) === present(old) && (stamp(row) > stamp(old) ||
        (stamp(row) === stamp(old) && fellowship(row.fellowship) < old.fellowship)));
    if (preferred) reconciled.set(group, {
      ...row, personId, attendanceDate: date, fellowship: fellowship(row.fellowship),
      attendanceStatus: present(row) ? 'present' : 'absent',
    });
    const merged = reconciled.get(group)!;
    if ((present(row) && ['yes', 'true', '1'].includes(String(row.firstTimer).toLowerCase())) ||
      (old && present(old) && ['yes', 'true', '1'].includes(String(old.firstTimer).toLowerCase()))) merged.firstTimer = 'Yes';
  });
  return [...reconciled.values()];
}
