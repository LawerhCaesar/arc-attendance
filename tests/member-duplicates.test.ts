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

test('flags a shared name without supporting contact or fellowship evidence', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'John Mensah', '0240000000', 'Pleroma'),
    member('2', 'Jon Mensah', '0559999999', 'Shalach'),
  );
  assert.ok(candidate);
  assert.ok(candidate.reasons.includes('Shared name: mensah'));
  assert.notEqual(candidate.confidence, 'high');
});

test('flags one name anywhere in a longer full name for review', () => {
  for (const name of ['nana', 'mekhi', 'osei', 'owusu']) {
    const candidate = duplicateCandidateForPair(
      member('1', 'Nana Mekhi Osei Owusu', '', ''),
      member('2', name, '', ''),
    );
    assert.ok(candidate, name);
    assert.equal(candidate.confidence, 'low');
    assert.ok(candidate.reasons.includes(`Shared name: ${name}`));
  }
});

test('normalizes shared name tokens and accepts short names', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'Li, André-Mensah', '', ''),
    member('2', 'li andre', '', ''),
  );
  assert.ok(candidate);
  assert.ok(candidate.reasons.includes('Shared name: li, andre'));
});

test('flags similar full names even without any other recorded details', () => {
  const candidate = duplicateCandidateForPair(
    member('1', 'Akosua', '', ''),
    member('2', 'Akoswa', '', ''),
  );
  assert.ok(candidate);
  assert.equal(candidate.confidence, 'medium');
});

test('any one shared member detail can independently suggest review', () => {
  const details = [
    { field: 'phone', left: '024 123 4567', right: '+233 24 123 4567', reason: 'Contact numbers match' },
    { field: 'fellowship', left: 'Shalach', right: ' SHALACH ', reason: 'Fellowships match' },
    { field: 'designation', left: 'Cell Leader', right: 'cell leader', reason: 'Designations match' },
    { field: 'birthday', left: '1990-01-14', right: '1990-01-14', reason: 'Birthdays match' },
    { field: 'location', left: 'East-Legon', right: 'east legon', reason: 'Locations match' },
  ];
  for (const { field, left, right, reason } of details) {
    const candidate = duplicateCandidateForPair(
      { ...member('1', 'Esi', '', ''), [field]: left },
      { ...member('2', 'Kwame', '', ''), [field]: right },
    );
    assert.ok(candidate, field);
    assert.deepEqual(candidate.reasons, [reason]);
    assert.notEqual(candidate.confidence, 'high');
    assert.ok(candidate.score < 80);
  }
});

test('blank details and fragments inside different names are not overlaps', () => {
  assert.equal(duplicateCandidateForPair(
    { ...member('1', 'Ann', ' ', ' '), designation: ' ', birthday: ' ', location: '---' },
    { ...member('2', 'Joanna', '', ''), designation: '', birthday: '', location: '' },
  ), null);
  assert.equal(duplicateCandidateForPair(
    member('1', '', '', ''), member('2', '', '', ''),
  ), null);
});

test('strong corroborated matches rank above a single overlapping detail', () => {
  const anchor = member('a', 'Esi Owusu', '0241234567', 'Pleroma');
  const candidates = findMemberDuplicateCandidates([
    anchor,
    member('b', 'Kwame', '', 'Pleroma'),
    member('c', 'Esi Owusu', '0241234567', 'Shalach'),
  ]);
  assert.equal(candidates[0].pairKey, 'a:c');
  assert.equal(candidates[0].confidence, 'high');
  assert.equal(candidates[1].confidence, 'low');
});

test('broader candidates still honor keep-separate decisions', () => {
  const members = [member('a', 'Nana Mekhi Osei Owusu', '', ''), member('b', 'Mekhi', '', '')];
  assert.equal(findMemberDuplicateCandidates(members).length, 1);
  assert.equal(findMemberDuplicateCandidates(members, new Set(['a:b'])).length, 0);
});

test('groups supported only by one shared detail retain low confidence', () => {
  const groups = groupMemberDuplicateCandidates(findMemberDuplicateCandidates([
    member('a', 'Esi', '', 'Pleroma'),
    member('b', 'Kwame', '', 'Pleroma'),
  ]));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].confidence, 'low');
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
