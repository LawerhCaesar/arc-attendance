import assert from 'node:assert/strict';
import test from 'node:test';
import { dateInAccra, nextBirthday, upcomingBirthdays } from '../lib/birthdays';

test('finds seven-day birthday reminders across a month boundary', () => {
  const birthday = nextBirthday('03-10', '2026-09-26');
  assert.equal(birthday?.daysUntil, 7);
  assert.equal(birthday?.nextDate, '2026-10-03');
});

test('upcoming birthdays include today and the window boundary, sorted soonest then by name', () => {
  const birthdays = upcomingBirthdays([
    { id: 'later', name: 'Later', birthday: '2026-12-19' },
    { id: 'z', name: 'Zoe', birthday: '20-10' },
    { id: 'a', name: 'Ama', birthday: '20-10' },
    { id: 'tomorrow', name: 'Tomorrow', birthday: '21-10' },
    { id: 'beyond', name: 'Beyond', birthday: '2026-12-20' },
    { id: 'past', name: 'Past', birthday: '19-10' },
    { id: 'bad', name: 'Invalid', birthday: '31-02' },
    { id: 'missing', name: 'Missing', birthday: null },
  ], '2026-10-20');
  assert.deepEqual(birthdays.map(person => person.id), ['a', 'z', 'tomorrow', 'later']);
  assert.deepEqual(birthdays.map(person => person.daysUntil), [0, 0, 1, 60]);
});

test('upcoming birthdays cross into the next year without including past birthdays', () => {
  const birthdays = upcomingBirthdays([{ id: 'a', name: 'Ama', birthday: '02-01' }], '2026-12-30');
  assert.equal(birthdays[0].nextBirthday, '2027-01-02');
  assert.equal(birthdays[0].daysUntil, 3);
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
