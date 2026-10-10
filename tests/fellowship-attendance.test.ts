import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileFellowshipAttendance } from '../lib/fellowship-attendance';
import type { AttendanceRecord, Member } from '../lib/database';

const row = (values: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  name: 'Ama Mensah', phone: '0503700378', fellowship: 'Shalach',
  date: '2026-10-04', attendanceStatus: 'present', birthday: '', location: '', firstTimer: 'No', ...values,
});
const member: Member = { id: 'a', name: 'Ama Mensah', phone: '0503700378', fellowship: 'Shalach', birthday: '', location: '', designation: 'Member' };

test('linked and legacy overlaps reconcile, present wins and different services remain', () => {
  const data = reconcileFellowshipAttendance([
    row({ member_id: 'a', attendanceStatus: 'absent' }),
    row({ phone: '+233 50 370 0378', name: 'Mensah Ama' }),
    row({ phone: '', fellowship: 'Tsalach', attendanceStatus: 'absent' }),
    row({ member_id: 'a', attendanceDate: '2026-09-27' }),
  ], [member]);
  assert.equal(data.length, 2);
  assert.ok(data.every(item => item.personId === 'member:a' && item.attendanceStatus === 'present'));
});

test('overlaps across fellowships count in exactly one fellowship independent of input order', () => {
  const rows = [row({ member_id: 'a', createdAt: new Date('2026-10-04T09:00:00Z') }),
    row({ member_id: 'a', fellowship: 'All Grace', createdAt: new Date('2026-10-04T10:00:00Z') }),
    row({ member_id: 'a', fellowship: 'Menorah', attendanceStatus: 'absent', createdAt: new Date('2026-10-04T11:00:00Z') })];
  for (const input of [rows, [...rows].reverse()]) {
    const result = reconcileFellowshipAttendance(input, [member]);
    assert.equal(result.length, 1);
    assert.equal(result[0].fellowship, 'All Grace');
  }
});

test('phone-less visitors reconcile and legacy blank status means present', () => {
  const result = reconcileFellowshipAttendance([row({ phone: '', attendanceStatus: '' }), row({ phone: '', attendanceStatus: 'absent' })], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].attendanceStatus, 'present');
});

test('shared phones and distinct roster IDs are never merged', () => {
  const result = reconcileFellowshipAttendance([
    row({ member_id: 'a' }), row({ member_id: 'b' }),
    row({ name: 'Different Person' }),
  ], [member, { ...member, id: 'b' }]);
  assert.equal(result.length, 3);
});

test('same name with conflicting phone numbers stays separate and missing dates are excluded', () => {
  assert.equal(reconcileFellowshipAttendance([row(), row({ phone: '0201234567' }), row({ date: '' })], []).length, 2);
});
