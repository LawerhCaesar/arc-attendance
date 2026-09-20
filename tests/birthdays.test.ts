import assert from 'node:assert/strict';
import test from 'node:test';
import { dateInAccra, nextBirthday } from '../lib/birthdays';

test('finds seven-day birthday reminders across a month boundary', () => {
  const birthday = nextBirthday('03-10', '2026-09-26');
  assert.equal(birthday?.daysUntil, 7);
  assert.equal(birthday?.nextDate, '2026-10-03');
});

test('rolls an elapsed birthday into the following year', () => {
  const birthday = nextBirthday('08/09', '2026-09-09');
  assert.equal(birthday?.nextDate, '2027-09-08');
  assert.equal(birthday?.daysUntil, 364);
});

test('accepts ISO birthdays and rejects invalid values', () => {
  assert.equal(nextBirthday('1994-09-10', '2026-09-09')?.daysUntil, 1);
  assert.equal(nextBirthday('unknown', '2026-09-09'), null);
  assert.equal(nextBirthday('31/02', '2026-09-09'), null);
});

test('uses the Accra calendar date', () => {
  assert.equal(dateInAccra(new Date('2026-09-09T23:30:00Z')), '2026-09-09');
});
