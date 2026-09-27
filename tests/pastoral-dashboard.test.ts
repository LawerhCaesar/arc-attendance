import assert from 'node:assert/strict';
import test from 'node:test';
import type { AttendanceRecord, Member } from '../lib/database';
import { buildPastoralDashboard } from '../lib/pastoral-dashboard';

const member = (overrides: Partial<Member>): Member => ({
  id: crypto.randomUUID(),
  name: 'Member',
  phone: '',
  fellowship: 'All Grace',
  designation: 'Member',
  birthday: '',
  location: '',
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
  ...overrides,
});

const attendance = (overrides: Partial<AttendanceRecord>): AttendanceRecord => ({
  date: '2026-09-06',
  attendanceDate: '2026-09-06',
  name: 'Member',
  phone: '',
  fellowship: 'All Grace',
  designation: 'Member',
  birthday: '',
  location: '',
  firstTimer: 'No',
  attendanceStatus: 'present',
  ...overrides,
});

test('counts unique people rather than duplicate attendance rows', () => {
  const rows = [
    attendance({ name: 'Ama Mensah', phone: '024 000 0001' }),
    attendance({ name: 'Ama Mensah', phone: '0240000001' }),
    attendance({ name: 'Ama Mensah', phone: '0240000002' }),
  ];
  const result = buildPastoralDashboard(rows, [], new Date('2026-09-09T12:00:00Z'));
  assert.equal(result.latestService.attendance, 2);
});

test('birthdays are derived once from the member roster', () => {
  const members = [member({ name: 'Kojo', birthday: '10-09', phone: '0240000003' })];
  const rows = [
    attendance({ name: 'Kojo', phone: '0240000003', birthday: '10-09', attendanceDate: '2026-08-30' }),
    attendance({ name: 'Kojo', phone: '0240000003', birthday: '10-09' }),
  ];
  const result = buildPastoralDashboard(rows, members, new Date('2026-09-09T12:00:00Z'));
  assert.equal(result.care.upcomingBirthdays.length, 1);
  assert.equal(result.care.upcomingBirthdays[0].daysUntil, 1);
});

test('flags members only after two eligible consecutive absences', () => {
  const members = [member({ name: 'Esi', phone: '0240000004', created_at: '2026-08-20T00:00:00Z' })];
  const rows = [
    attendance({ name: 'Other', phone: '0240000099', attendanceDate: '2026-08-16' }),
    attendance({ name: 'Other', phone: '0240000099', attendanceDate: '2026-08-23' }),
    attendance({ name: 'Esi', phone: '0240000004', attendanceDate: '2026-08-30', attendanceStatus: 'absent' }),
    attendance({ name: 'Esi', phone: '0240000004', attendanceDate: '2026-09-06', attendanceStatus: 'absent' }),
  ];
  const result = buildPastoralDashboard(rows, members, new Date('2026-09-09T12:00:00Z'));
  assert.equal(result.care.absentMembers.length, 1);
  assert.equal(result.care.absentMembers[0].consecutiveAbsences, 3);
});

test('recognizes a first timer who returned at a later service', () => {
  const rows = [
    attendance({ name: 'Yaw', phone: '0240000005', attendanceDate: '2026-08-30', firstTimer: 'Yes' }),
    attendance({ name: 'Yaw', phone: '0240000005', attendanceDate: '2026-09-06' }),
  ];
  const result = buildPastoralDashboard(rows, [], new Date('2026-09-09T12:00:00Z'));
  assert.equal(result.latestService.returningVisitors, 1);
  assert.equal(result.care.recentFirstTimers[0].hasReturned, true);
});

test('merged history is matched by member ID and a present service ends the absence streak', () => {
  const members = [member({ id: 'primary', name: 'New Name', phone: '0240000006' })];
  const rows = [
    attendance({ member_id: 'primary', name: 'Old Name', attendanceDate: '2026-08-23', attendanceStatus: 'absent' }),
    attendance({ member_id: 'primary', name: 'Old Name', attendanceDate: '2026-08-30', attendanceStatus: 'absent' }),
    attendance({ member_id: 'primary', name: 'Another Old Name', attendanceDate: '2026-09-06', attendanceStatus: 'present' }),
  ];
  const result = buildPastoralDashboard(rows, members, new Date('2026-09-09T12:00:00Z'));
  assert.equal(result.latestService.memberAttendanceRate, 100);
  assert.equal(result.care.absentMembers.length, 0);
});

test('period totals include both boundaries, count visits and unique people separately, and retain first-visit history', () => {
  const members = [member({ id: 'ama', name: 'Ama' }), member({ id: 'kojo', name: 'Kojo' })];
  const rows = [
    attendance({ member_id: 'ama', name: 'Ama', attendanceDate: '2025-12-28', firstTimer: 'Yes' }),
    attendance({ member_id: 'ama', name: 'Ama', attendanceDate: '2026-01-04', firstTimer: 'Yes' }),
    attendance({ member_id: 'ama', name: 'Ama', attendanceDate: '2026-01-04' }),
    attendance({ member_id: 'ama', name: 'Ama', attendanceDate: '2026-01-11' }),
    attendance({ member_id: 'kojo', name: 'Kojo', attendanceDate: '2026-01-11', firstTimer: 'Yes' }),
    attendance({ name: 'Later', phone: '0249999999', attendanceDate: '2026-01-18', firstTimer: 'Yes' }),
  ];
  const result = buildPastoralDashboard(rows, members, new Date('2026-01-20T12:00:00Z'), { start: '2026-01-04', end: '2026-01-11' });
  assert.equal(result.period?.attendance, 3);
  assert.equal(result.period?.uniquePeople, 2);
  assert.equal(result.period?.services, 2);
  assert.equal(result.period?.firstTimers, 1);
  assert.equal(result.trend.reduce((sum, point) => sum + point.firstTimers, 0), result.period?.firstTimers);
  assert.equal(result.period?.memberAttendanceRate, 100);
  assert.deepEqual(result.trend.map(point => point.date), ['2026-01-04', '2026-01-11']);
  assert.equal(result.fellowships[0].present, 2);
  assert.equal(result.care.recentFirstTimers.length, 1);
  assert.equal(result.care.recentFirstTimers[0].name, 'Kojo');
});

test('an empty selected day never falls back to an earlier service', () => {
  const result = buildPastoralDashboard([attendance({})], [member({})], new Date('2026-09-09T12:00:00Z'), { start: '2026-09-09', end: '2026-09-09' });
  assert.equal(result.period?.attendance, 0);
  assert.equal(result.period?.services, 0);
  assert.equal(result.period?.memberAttendanceRate, 0);
  assert.equal(result.trend.length, 0);
  assert.equal(result.fellowships[0].present, 0);
});

test('upcoming birthday total is not truncated to the number displayed', () => {
  const members = Array.from({ length: 20 }, () => member({ birthday: '10-09' }));
  members.push(member({ birthday: '31-09' }));
  const result = buildPastoralDashboard([], members, new Date('2026-09-09T12:00:00Z'));
  assert.equal(result.care.upcomingBirthdays.length, 20);
  assert.equal(result.dataQuality.missingBirthday, 1);
});
