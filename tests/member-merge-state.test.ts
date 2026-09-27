import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMemberMerge } from '../lib/member-merge-state';

test('a retry of a completed 1,367-record merge is a success with no further writes', () => {
  const members = [{ id: 'primary', is_active: true, merged_into_id: null },
    ...Array.from({ length: 1367 }, (_, i) => ({ id: `secondary-${i}`, is_active: false, merged_into_id: 'primary' }))];
  assert.deepEqual(evaluateMemberMerge(members, members.map(m => m.id), 'primary'), { state: 'complete', secondaryIds: [] });
});

test('a partially completed group only sends active secondary records to the merge', () => {
  const members = [{ id: 'p', is_active: true }, { id: 'a', is_active: false, merged_into_id: 'p' }, { id: 'b', is_active: true }];
  assert.deepEqual(evaluateMemberMerge(members, ['p', 'a', 'b'], 'p'), { state: 'pending', secondaryIds: ['b'] });
});

test('deleted records or records merged elsewhere require a fresh review', () => {
  for (const merged_into_id of [null, 'other']) {
    const members = [{ id: 'p', is_active: true }, { id: 'a', is_active: false, merged_into_id }];
    assert.equal(evaluateMemberMerge(members, ['p', 'a'], 'p').state, 'stale');
  }
  assert.equal(evaluateMemberMerge([{ id: 'p', is_active: true }], ['p', 'missing'], 'p').state, 'stale');
});

test('a primary that has been merged or removed cannot silently absorb another group', () => {
  assert.equal(evaluateMemberMerge([{ id: 'p', is_active: false, merged_into_id: 'other' }, { id: 'a', is_active: true }], ['p', 'a'], 'p').state, 'stale');
});
