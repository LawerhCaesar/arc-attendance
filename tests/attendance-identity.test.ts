import assert from 'node:assert/strict';
import test from 'node:test';
import { consolidateLinkedAttendance, matchesRosterMember, presentRosterMemberIds } from '../lib/attendance-identity';
import type { AttendanceRecord, Member } from '../lib/database';

const row = (overrides: Partial<AttendanceRecord>): AttendanceRecord => ({
  name: 'Test Member', phone: '', fellowship: 'Test', birthday: '', location: '',
  date: '2026-09-27', firstTimer: 'No', attendanceStatus: 'absent', ...overrides,
});

test('saved check-in status includes only present active roster members in the requested service', () => {
  const members: Member[] = ['present', 'absent', 'previous', 'merged'].map(id => ({
    id, name: id, phone: '', fellowship: 'Test', birthday: '', location: '', designation: 'Member',
    is_active: id !== 'merged',
  }));
  const rows = [
    row({ member_id: 'present', attendanceStatus: 'present' }),
    row({ member_id: 'present', attendanceStatus: 'absent' }),
    row({ member_id: 'absent', attendanceStatus: 'absent' }),
    row({ member_id: 'previous', attendanceDate: '2026-09-20', attendanceStatus: 'present' }),
    row({ member_id: 'merged', attendanceStatus: 'present' }),
    row({ member_id: 'not-in-roster', attendanceStatus: 'present' }),
  ];
  assert.deepEqual(presentRosterMemberIds(rows, members, '2026-09-27'), ['present']);
  assert.deepEqual(presentRosterMemberIds(rows, members, '2026-10-04'), []);
});

test('saved status recognizes legacy attendance without exposing visitor details', () => {
  const member: Member = { id: 'legacy', name: 'Ama Mensah', phone: '0241111111', fellowship: 'All Grace', birthday: '', location: '', designation: 'Member' };
  assert.deepEqual(presentRosterMemberIds([
    row({ name: 'Mensah Ama', phone: '', fellowship: 'All Grace', attendanceStatus: '' }),
    row({ name: 'Private Visitor', phone: '0243333333', attendanceStatus: 'present' }),
  ], [member], '2026-09-27'), ['legacy']);
});

test('merged attendance preserves all services and present/first-visit evidence', () => {
  const rows = [
    row({ member_id: 'primary', attendanceDate: '2026-09-20' }),
    row({ member_id: 'primary', attendanceDate: '2026-09-20', attendanceStatus: 'present', firstTimer: 'Yes' }),
    row({ member_id: 'primary', attendanceDate: '2026-09-27' }),
    row({ member_id: 'other', attendanceDate: '2026-09-20', attendanceStatus: 'present' }),
  ];
  const merged = consolidateLinkedAttendance(rows);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].attendanceStatus, 'present');
  assert.equal(merged[0].firstTimer, 'Yes');
  assert.equal(merged[1].attendanceDate, '2026-09-27');
  assert.equal(merged[1].attendanceStatus, 'absent');
  assert.equal(rows[0].attendanceStatus, 'absent');
});

test('permanent member identity takes precedence over changed contact details', () => {
  const member = { id: 'primary', name: 'New Name', phone: '0241111111', fellowship: 'New' };
  assert.equal(matchesRosterMember(row({ member_id: 'primary' }), member), true);
  assert.equal(matchesRosterMember(row({ ...member, member_id: 'other' }), member), false);
});

test('legacy matching supports country codes and missing historical contact details', () => {
  const member = { id: 'a', name: 'Ama Mensah', phone: '0241111111', fellowship: 'All Grace' };
  assert.equal(matchesRosterMember(row({ phone: '+233 24 111 1111' }), member), true);
  assert.equal(matchesRosterMember(row({ name: 'Mensah Ama', fellowship: 'All Grace' }), member), true);
  assert.equal(matchesRosterMember(row({ name: 'Ama Mensah', fellowship: 'All Grace', phone: '0242222222' }), member), false);
});
