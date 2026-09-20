import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactSimilarity,
  duplicateCandidateForPair,
  findMemberDuplicateCandidates,
  nameSimilarity,
} from '../lib/member-duplicates';

const member = (id: string, name: string, phone: string, fellowship: string) => ({ id, name, phone, fellowship });

test('matches reordered names and Ghana phone formats', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'Ama Serwaa Mensah', '024 123 4567', 'Tsalach'),
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
    member('2', 'Jon Mensah', '0559999999', 'Tsalach'),
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

test('uses similarity rather than raw formatting', () => {
  assert.equal(contactSimilarity('020-111-2233', '+233 20 111 2233'), 1);
  assert.equal(nameSimilarity('Adwoa  Frimpong', 'frimpong, adwoa'), 1);
});
