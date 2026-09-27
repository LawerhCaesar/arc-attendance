import assert from 'node:assert/strict';
import test from 'node:test';
import type { Member } from '../lib/database';
import { buildMemberDemographics } from '../lib/member-demographics';

const member = (birthday: string, is_active = true): Member => ({
  id: crypto.randomUUID(), name: 'Member', phone: '', fellowship: 'All Grace',
  designation: 'Member', birthday, location: '', is_active,
});

test('birthday buckets reconcile to the active roster, excluding merged records', () => {
  const members = [member('10-09'), member('2000-09-12'), member('15/04'), member(''), member('31-02'), member('10-09', false)];
  const result = buildMemberDemographics(members);
  assert.equal(result.totalMembers, 5);
  assert.equal(result.validBirthdays, 3);
  assert.equal(result.missingBirthdays, 1);
  assert.equal(result.invalidBirthdays, 1);
  assert.equal(result.birthdays.length, 12);
  assert.equal(result.birthdays[8].count, 2);
  assert.equal(result.validBirthdays + result.missingBirthdays + result.invalidBirthdays, result.totalMembers);
  assert.equal(result.locations.reduce((sum, item) => sum + item.count, 0), result.totalMembers);
});

test('demographics include all roster members beyond the old 1,000-row limit', () => {
  const result = buildMemberDemographics(Array.from({ length: 1300 }, () => member('29-02')));
  assert.equal(result.birthdays[1].count, 1300);
  assert.equal(result.validBirthdays, 1300);
});
