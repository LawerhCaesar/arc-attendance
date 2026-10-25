import assert from 'node:assert/strict';
import test from 'node:test';
import {
  duplicateCandidateForPair,
  findMemberDuplicateCandidates,
  groupMemberDuplicateCandidates,
  normalizeDuplicatePhone,
} from '../lib/member-duplicates';

const member = (id: string, name = 'Esi Owusu', phone = '0503700378', fellowship = 'Pleroma') => ({ id, name, phone, fellowship });

test('Ghana phone formats share one duplicate identifier', () => {
  for (const phone of ['0503700378', '503700378', '+233503700378', '233503700378',
    '00233503700378', '+233 (0) 50 370 0378', '2330503700378', '00233 (0) 50 370 0378',
    '(050) 370-0378', '050.370.0378', "'0503700378"]) {
    assert.equal(normalizeDuplicatePhone(phone), '233503700378', phone);
  }
  assert.equal(normalizeDuplicatePhone('0233123456'), '233233123456');
  assert.equal(normalizeDuplicatePhone('233123456'), '233233123456');
  assert.equal(normalizeDuplicatePhone('0302123456'), '233302123456');
});

test('exact normalized phone matches are reviewed even when all other details differ', () => {
  const candidate = duplicateCandidateForPair(
    { ...member('a'), birthday: '01-01', location: 'Accra', designation: 'Member' },
    { ...member('b', 'Kwame Boateng', '+233503700378', 'Shalach'), birthday: '06-12', location: 'Tema', designation: 'Cell Leader' },
  );
  assert.ok(candidate);
  assert.deepEqual(candidate.reasons, ['Phone numbers match']);
  assert.equal(candidate.score, 100);
});

test('matching names and other member details cannot override different phone numbers', () => {
  const shared = { name: 'Nana Mekhi Osei Owusu', fellowship: 'Shalach', birthday: '06-12', location: 'Accra', designation: 'Member' };
  assert.equal(duplicateCandidateForPair(
    { ...shared, id: 'a', phone: '0503700378' },
    { ...shared, id: 'b', phone: '0201234567' },
  ), null);
  assert.equal(duplicateCandidateForPair(member('a'), member('b', 'Mekhi', '0201234567')), null);
});

test('one changed phone digit is a different identifier', () => {
  assert.equal(duplicateCandidateForPair(member('a'), member('b', 'Esi Owusu', '0503700379')), null);
});

test('missing, incomplete and malformed phones do not match, even on identical records', () => {
  for (const phone of ['', ' ', 'N/A', '0000000000', '050370', '50370037', '050370037899',
    '+23350370037899', 'phone 0503700378', '0503700378 / 0201234567', '0503700378 ext 2']) {
    assert.equal(normalizeDuplicatePhone(phone), null, phone);
    assert.equal(duplicateCandidateForPair(member('a', 'Esi', phone), member('b', 'Esi', phone)), null, phone);
  }
  assert.equal(normalizeDuplicatePhone(null), null);
  assert.equal(normalizeDuplicatePhone(undefined), null);
});

test('international country codes are retained instead of comparing their last nine digits', () => {
  assert.equal(normalizeDuplicatePhone('+44 503700378'), '44503700378');
  assert.equal(normalizeDuplicatePhone('0044 503700378'), '44503700378');
  assert.equal(normalizeDuplicatePhone('44503700378'), '44503700378');
  assert.equal(duplicateCandidateForPair(member('a'), member('b', 'Esi', '+44 503700378')), null);
  assert.equal(duplicateCandidateForPair(member('a', 'Esi', '+44 503700378'), member('b', 'Esi', '+33 503700378')), null);
});

test('a member never matches itself', () => {
  assert.equal(duplicateCandidateForPair(member('a'), member('a')), null);
  assert.equal(findMemberDuplicateCandidates([member('a'), member('a')]).length, 0);
});

test('one shared phone groups records despite different names and fellowships', () => {
  const candidates = findMemberDuplicateCandidates([
    member('a'), member('b', 'Mekhi', '+233503700378', 'Shalach'), member('c', 'Ama', '503700378', 'Grace'),
  ]);
  assert.equal(candidates.length, 2);
  const groups = groupMemberDuplicateCandidates(candidates);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].memberIds, ['a', 'b', 'c']);
  assert.equal(groups[0].matchCount, 2);
});

test('keep-separate decisions suppress the reviewed phone match', () => {
  const members = [member('a'), member('b')];
  assert.equal(findMemberDuplicateCandidates(members).length, 1);
  assert.equal(findMemberDuplicateCandidates(members, new Set(['a:b'])).length, 0);
});

test('excluding an anchor pair does not hide an unreviewed match to another member', () => {
  const candidates = findMemberDuplicateCandidates([member('a'), member('b'), member('c')], new Set(['a:c']));
  assert.deepEqual(new Set(candidates.map(candidate => candidate.pairKey)), new Set(['a:b', 'b:c']));
});

test('a fully reviewed shared phone produces no new candidates', () => {
  assert.equal(findMemberDuplicateCandidates([member('a'), member('b'), member('c')], new Set(['a:b', 'a:c', 'b:c'])).length, 0);
});

test('distinct phones form separate groups, while missing phones stay out of the count', () => {
  const groups = groupMemberDuplicateCandidates(findMemberDuplicateCandidates([
    member('a'), member('b'), member('c', 'Esi', '0201234567'), member('d', 'Ama', '+233201234567'), member('e', 'Esi', ''),
  ]));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.memberIds.join(':')).sort(), ['a:b', 'c:d']);
});

test('large repeated imports use a single review anchor rather than every possible pair', () => {
  const members = Array.from({ length: 2000 }, (_, index) => member(String(index), `Member ${index}`));
  const candidates = findMemberDuplicateCandidates(members);
  assert.equal(candidates.length, 1999);
  assert.equal(groupMemberDuplicateCandidates(candidates).length, 1);
});

test('changing a phone invalidates a previously suggested duplicate pair', () => {
  const original = member('a');
  const changed = member('b');
  assert.ok(duplicateCandidateForPair(original, changed));
  changed.phone = '0201234567';
  assert.equal(duplicateCandidateForPair(original, changed), null);
});

test('Michael-style imported copies with missing phones include archived records for review', () => {
  const copies = Array.from({ length: 13 }, (_, index) => ({ id: String(index), name: 'Acheampong Michael',
    phone: index === 0 ? '-' : '', fellowship: 'Young and Ready', birthday: '17-05', location: 'Amamoley', is_active: index > 2 }));
  const groups = groupMemberDuplicateCandidates(findMemberDuplicateCandidates(copies));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].memberIds.length, 13);
  assert.equal(groups[0].anchor.is_active, true);
  assert.equal(groups[0].confidence, 'medium');
  assert.ok(groups[0].reasons.includes('Birthdays match'));
  assert.equal(findMemberDuplicateCandidates(copies, new Set(copies.flatMap(a => copies.filter(b => a.id !== b.id).map(b => [a.id,b.id].sort().join(':'))))).length, 0);
});

test('missing-phone evidence requires a full name, fellowship and a supporting detail', () => {
  const a = { ...member('a', 'Acheampong Michael', ''), birthday: '17-05', location: 'Accra' };
  assert.ok(duplicateCandidateForPair(a, { ...a, id: 'b', name: 'Michael Acheampong', phone: '-' }));
  assert.equal(duplicateCandidateForPair(a, { ...a, id: 'b', name: 'Michael' }), null);
  assert.equal(duplicateCandidateForPair(a, { ...a, id: 'b', fellowship: 'Shalach' }), null);
  assert.equal(duplicateCandidateForPair(a, { ...a, id: 'b', birthday: '', location: '' }), null);
  assert.equal(duplicateCandidateForPair(a, { ...a, id: 'b', merged_into_id: 'a' }), null);
  assert.equal(duplicateCandidateForPair({ ...a, phone: '0201234567' }, { ...a, id: 'b', phone: '0241234567' }), null);
});
