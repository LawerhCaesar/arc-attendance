import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPastoralInsights, memberInformationIssues } from '../lib/pastoral-insights';
import { careCounts, validateCareUpdate, type CareTask } from '../lib/care-followups';
import type { AttendanceRecord, Member } from '../lib/database';
const member: Member = { id: 'm', name: 'Member One', phone: '0503700378', fellowship: 'Shalach', designation: 'Member', birthday: '11-10', location: '', created_at: '2026-01-01' };
const row = (date: string, values: Partial<AttendanceRecord> = {}): AttendanceRecord => ({ date, attendanceDate: date, name: member.name, phone: member.phone, fellowship: member.fellowship, birthday: '', location: '', firstTimer: 'No', attendanceStatus: 'present', member_id: 'm', ...values });
const now = new Date('2026-10-10T12:00:00Z');

test('weekly brief reconciles overlaps, preserves first visits and excludes future services', () => {
  const result = buildPastoralInsights([
    row('2026-09-27', { firstTimer: 'Yes' }), row('2026-09-27'), row('2026-10-04'), row('2026-10-04', { attendanceStatus: 'absent' }), row('2026-10-11'),
  ], [member], now);
  assert.equal(result.latestDate, '2026-10-04');
  assert.equal(result.latestAttendance, 1);
  assert.equal(result.returningVisitors, 1);
  assert.deepEqual(result.retention, { eligible: 1, returned: 1, rate: 100 });
  assert.equal(result.suggestions.filter(item => item.category === 'birthday').length, 1);
});
test('brand-new visitors without another service are not counted as failed retention', () => {
  const result = buildPastoralInsights([row('2026-10-04', { firstTimer: 'Yes' })], [], now);
  assert.deepEqual(result.retention, { eligible: 0, returned: 0, rate: null });
  assert.equal(result.suggestions[0].category, 'visitor');
});
test('consistency uses four services and welcomes back members after two missed services', () => {
  const result = buildPastoralInsights([
    row('2026-09-13'), row('2026-09-20', { attendanceStatus: 'absent' }), row('2026-09-27', { attendanceStatus: 'absent' }), row('2026-10-04'),
  ], [member], now);
  assert.equal(result.returnedMembers.length, 1);
  assert.deepEqual(result.consistency, { eligible: 1, consistent: 0, rate: 0 });
  assert.equal(result.suggestions.filter(item => item.category === 'absence').length, 0);
});
test('care counts are not truncated and data quality counts people only once', () => {
  const members = Array.from({ length: 20 }, (_, i) => ({ ...member, id: String(i), phone: '', birthday: '', fellowship: '' }));
  const result = buildPastoralInsights([row('2026-09-27'), row('2026-10-04')], members, now);
  assert.equal(result.suggestions.filter(item => item.category === 'absence').length, 20);
  assert.equal(result.dataQuality.length, 20);
  assert.equal(result.dataQuality[0].issues.length, 3);
});
test('completing details removes the person from the list and partial fixes retain only unresolved issues', () => {
  const incomplete = { ...member, phone: '', birthday: '', fellowship: 'Unassigned' };
  const partial = { ...incomplete, phone: '0241234567' };
  const complete = { ...partial, birthday: '12-10', fellowship: 'Shalach' };
  assert.deepEqual(memberInformationIssues(partial, '2026-10-10'), ['Missing / invalid birthday', 'Unassigned fellowship']);
  assert.deepEqual(memberInformationIssues({ ...complete, birthday: '31-02' }, '2026-10-10'), ['Missing / invalid birthday']);
  assert.equal(buildPastoralInsights([], [incomplete], now).dataQuality.length, 1);
  assert.equal(buildPastoralInsights([], [partial], now).dataQuality.length, 1);
  assert.equal(buildPastoralInsights([], [complete], now).dataQuality.length, 0);
});
test('follow-up validation requires real dates, owners and outcomes for closed tasks', () => {
  const valid = { owner: 'pastor', due_date: '2026-10-12', status: 'open', priority: 'normal', outcome: '' };
  assert.equal(validateCareUpdate(valid).owner, 'pastor');
  for (const invalid of [{ due_date: '2026-02-30' }, { owner: '' }, { status: 'completed' }, { status: 'dismissed' }, { priority: 'urgent' }, { outcome: 'a'.repeat(1001) }]) {
    assert.throws(() => validateCareUpdate({ ...valid, ...invalid }));
  }
  assert.equal(validateCareUpdate({ ...valid, status: 'completed', outcome: 'Contact made' }).status, 'completed');
});
test('overdue counts exclude closed tasks and distinguish due today', () => {
  const tasks = [{ status: 'open', due_date: '2026-10-09' }, { status: 'in_progress', due_date: '2026-10-10' }, { status: 'completed', due_date: '2026-10-08' }] as CareTask[];
  assert.deepEqual(careCounts(tasks, '2026-10-10'), { open: 2, overdue: 1, dueToday: 1, completed: 1 });
});
