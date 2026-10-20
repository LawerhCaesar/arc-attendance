import assert from 'node:assert/strict';
import test from 'node:test';
import { fellowshipAttendanceReport, fellowshipBirthdayDirectory, validServiceDate, type HistoryMemberInput, type HistoryAttendanceInput } from '../lib/fellowship-insights';

const member = (values: Partial<HistoryMemberInput> = {}): HistoryMemberInput => ({ id: 'a', name: 'Ama Boateng', phone: '0201234567', fellowship: 'Shalach', is_active: true, ...values });
const row = (values: Partial<HistoryAttendanceInput> = {}): HistoryAttendanceInput => ({ name: 'Ama Boateng', phone: '0201234567', fellowship: 'Shalach', date: '2026-10-20', attendanceDate: '2026-10-18', attendanceStatus: 'present', ...values });
const report = (members: HistoryMemberInput[], rows: HistoryAttendanceInput[]) => fellowshipAttendanceReport(members, rows, 'Shalach', '2026-10-20');

test('birthday directory covers the full year, sorts next birthdays, and retains missing/invalid details', () => {
  const directory = fellowshipBirthdayDirectory([
    { id: 'a', name: 'Ama', birthday: '20-10', phone: '0201234567' }, { id: 'b', name: 'Kojo', birthday: '01-01' },
    { id: 'c', name: 'Esi', birthday: '19-10' }, { id: 'd', name: 'Missing', birthday: '' },
    { id: 'e', name: 'Invalid', birthday: '31-02' },
  ], '2026-10-20');
  assert.deepEqual(directory.map(person => person.id), ['a', 'b', 'c', 'e', 'd']);
  assert.equal(directory[0].daysUntil, 0);
  assert.equal(directory[0].phone, '0201234567');
  assert.equal(directory[1].phone, '');
  assert.equal(directory[1].month, 1);
  assert.equal(directory[2].nextBirthday, '2027-10-19');
  assert.equal(directory[4].birthdayLabel, null);
  assert.ok(directory.every(person => !('birthday' in person)));
});

test('service date wins over submission date; overlaps count once and present wins', () => {
  const result = report([member()], [row({ member_id: 'a', attendanceStatus: 'absent' }), row({ phone: '+233 20 123 4567' }),
    row({ phone: '', name: 'Boateng Ama' }), row({ attendanceDate: '2026-10-11', attendanceStatus: 'absent' })]);
  assert.deepEqual(result.members[0].history, [{ date: '2026-10-18', status: 'present' }, { date: '2026-10-11', status: 'absent' }]);
  assert.equal(result.unlinkedRecords, 0);
});

test('call details use the current roster number rather than a historical check-in number', () => {
  const result = report([member({ phone: '+233 27 765 4321' })], [row({ member_id: 'a', phone: '0201234567' })]);
  assert.equal(result.members[0].phone, '+233 27 765 4321');
  assert.equal(result.members[0].history.length, 1);
});

test('archived brethren are excluded from reports and zero-history members never receive inferred absences', () => {
  const result = report([member({ is_active: false }), member({ id: 'b', name: 'Kojo', phone: '' })], [row({ member_id: 'a' })]);
  assert.deepEqual(result.members.map(member => member.id), ['b']);
  assert.deepEqual(result.members[0].history, []);
  assert.equal(result.unlinkedRecords,0);
});

test('other fellowships and merged members never enter the report; explicit IDs cannot be reassigned by matching phone', () => {
  const result = report([member(), member({ id: 'b', fellowship: 'Pleroma' }), member({ id: 'c', merged_into_id: 'a', is_active: false })],
    [row({ member_id: 'b' }), row({ member_id: 'c' }), row({ member_id: 'a', fellowship: 'Pleroma' })]);
  assert.deepEqual(result.members.map(person => person.id), ['a']);
  assert.deepEqual(result.members[0].history, []);
  assert.equal(result.unlinkedRecords, 2);
});

test('ambiguous legacy identities remain unlinked rather than inflating totals', () => {
  const result = report([member(), member({ id: 'b' })], [row(), row({ phone: '' })]);
  assert.equal(result.unlinkedRecords, 2);
  assert.ok(result.members.every(person => person.history.length === 0));
});

test('international phones with the same trailing digits stay distinct', () => {
  const result = report([member({ phone: '+44 20 1234 5678' }), member({ id: 'b', name: 'Kojo', phone: '+233 20 123 4567' })],
    [row({ phone: '+44 20 1234 5678' }), row({ name: 'Kojo', phone: '0201234567' })]);
  assert.ok(result.members.every(person => person.history.length === 1));
});

test('future/invalid dates and unknown statuses are excluded; blank legacy status is present', () => {
  const result = report([member()], [row({ attendanceDate: '2026-10-25' }), row({ attendanceDate: '2026-02-30' }),
    row({ attendanceStatus: 'unknown' }), row({ attendanceStatus: '', attendanceDate: '', date: '2026-10-04' })]);
  assert.deepEqual(result.members[0].history, [{ date: '2026-10-04', status: 'present' }]);
  assert.equal(validServiceDate('2026-2-3'), false);
  assert.equal(validServiceDate('2028-02-29'), true);
});
