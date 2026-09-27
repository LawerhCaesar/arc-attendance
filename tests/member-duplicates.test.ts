import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactSimilarity,
  duplicateCandidateForPair,
  findMemberDuplicateCandidates,
  groupMemberDuplicateCandidates,
  nameSimilarity,
} from '../lib/member-duplicates';

const member = (id: string, name: string, phone: string, fellowship: string) => ({ id, name, phone, fellowship });

test('matches reordered names and Ghana phone formats', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'Ama Serwaa Mensah', '024 123 4567', 'Shalach'),
    member('2', 'Mensah Ama Serwaa', '+233 24 123 4567', 'Grace'),
  );
  assert.ok(candidate);
  assert.equal(candidate?.confidence, 'high');
  assert.ok(candidate?.reasons.includes('Contact numbers match'));
});

test('flags a minor name variation in the same fellowship', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'Kwame Boateng', '', 'Pleroma'),
    member('2', 'Kwame Boatengh', '', 'Pleroma'),
  );
  assert.ok(candidate);
  assert.ok((candidate?.score || 0) >= 80);
});

test('does not flag similar names without supporting contact or fellowship evidence', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'John Mensah', '0240000000', 'Pleroma'),
    member('2', 'Jon Mensah', '0559999999', 'Shalach'),
  );
  assert.equal(candidate, null);
});

test('respects decisions to keep a pair separate', () => {
  const members = [
    member('a', 'Esi Owusu', '0240000000', 'Pleroma'),
    member('b', 'Esi Owusu', '0240000000', 'Pleroma'),
  ];
  assert.equal(findMemberDuplicateCandidates(members).length, 1);
  assert.equal(findMemberDuplicateCandidates(members, new Set(['a:b'])).length, 0);
});

test('collapses an exact duplicate group around one canonical record', () => {
  const members = [
    member('a', 'Esi Owusu', '', 'Pleroma'),
    member('b', 'Esi Owusu', '', 'Pleroma'),
    member('c', 'Esi Owusu', '', 'Pleroma'),
    member('d', 'Esi Owusu', '', 'Pleroma'),
  ];

  const candidates = findMemberDuplicateCandidates(members);
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every(candidate => [candidate.memberA.id, candidate.memberB.id].includes('a')));
});

test('groups one canonical record with all of its possible matches', () => {
  const members = [
    member('a', 'Esi Owusu', '', 'Pleroma'),
    member('b', 'Esi Owusu', '', 'Pleroma'),
    member('c', 'Esi Owusu', '', 'Pleroma'),
    member('d', 'Esi Owusu', '', 'Pleroma'),
  ];

  const groups = groupMemberDuplicateCandidates(findMemberDuplicateCandidates(members));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].anchor.id, 'a');
  assert.equal(groups[0].matchCount, 3);
  assert.deepEqual(groups[0].memberIds, ['a', 'b', 'c', 'd']);
});

test('uses similarity rather than raw formatting', () => {
  assert.equal(contactSimilarity('020-111-2233', '+233 20 111 2233'), 1);
  assert.equal(nameSimilarity('Adwoa  Frimpong', 'frimpong, adwoa'), 1);
});
