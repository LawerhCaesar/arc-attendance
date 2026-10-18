import assert from 'node:assert/strict';
import test from 'node:test';
import { birthdayLeaderContacts, birthdayReminderJobs, type ReminderAccount } from '../lib/birthday-reminders';

const account = (email: string | null, fellowship: string, other: Partial<ReminderAccount> = {}): ReminderAccount => ({
  email, fellowship, role_id: 'leader-role', is_active: true, configured_username: null, ...other,
});
test('birthday recipients respect active fellowship roles and retire configured overrides', () => {
  const contacts = birthdayLeaderContacts([
    account('ama@example.com', 'Shalach'), account('disabled@example.com', 'Shalach', { is_active: false }),
    account('pastor@example.com', 'Shalach', { role_id: 'pastor-role' }), account(null, 'Shalach'),
    account('invalid-email', 'Shalach'), account('unassigned@example.com', 'Unknown'),
    account('override@example.com', 'Shalach', { is_active: false, configured_username: 'old-leader' }),
  ], 'leader-role', [
    { username: 'old-leader', role: 'fellowship_leader', email: 'retired@example.com', fellowship: 'Shalach' },
    { username: 'configured', role: 'fellowship_leader', email: 'esi@example.com', fellowship: 'Pleroma' },
  ]);
  assert.deepEqual(contacts, [{ email: 'ama@example.com', fellowship: 'Shalach' }, { email: 'esi@example.com', fellowship: 'Pleroma' }]);
});

test('each leader receives only their fellowship birthdays and duplicate recipients receive one message', () => {
  const contacts = birthdayLeaderContacts([account('ama@example.com', 'Shalach'), account('ama@example.com', 'Shalach'), account('second@example.com', 'Shalach'), account('esi@example.com', 'Pleroma')], 'leader-role', []);
  const members = [
    { id: 'a', name: 'A', fellowship: 'Shalach', birthday: '25-10' },
    { id: 'b', name: 'B', fellowship: 'Pleroma', birthday: '19-10' },
    { id: 'c', name: 'C', fellowship: 'Shalach', birthday: '18-10' },
    { id: 'd', name: 'D', fellowship: 'Shalach', birthday: 'invalid' },
  ];
  const jobs = birthdayReminderJobs(members, contacts, '2026-10-18', 'office@example.com');
  assert.deepEqual(jobs.filter(job => job.member.id === 'a').map(job => job.recipient).sort(), ['ama@example.com', 'office@example.com', 'second@example.com']);
  assert.deepEqual(jobs.filter(job => job.member.id === 'b').map(job => job.recipient).sort(), ['esi@example.com', 'office@example.com']);
  assert.equal(jobs.some(job => ['c', 'd'].includes(job.member.id)), false);
  assert.equal(new Set(jobs.map(job => job.idempotencyKey)).size, jobs.length);
  assert.deepEqual(jobs.map(job => job.idempotencyKey), birthdayReminderJobs(members, contacts, '2026-10-18', 'office@example.com').map(job => job.idempotencyKey));
});
