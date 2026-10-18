import assert from 'node:assert/strict';
import test from 'node:test';
import { fellowshipBreakdown } from '../lib/fellowship-structure';
import { assertFellowshipAccess, memberFellowshipScope, MemberInputError, parseMemberInput } from '../lib/member-scope';
import { fellowshipLeaderUsername, isSuperAdmin } from '../lib/super-admin';

const leader = { role: 'fellowship_leader', fellowship: 'Shalach' };
const valid = { name: 'Ama Mensah', phone: '0241234567', fellowship: 'Shalach', designation: 'Member', birthday: '02-10', location: 'Accra' };

test('fellowship leader scope is required and cannot come from request data', () => {
  assert.equal(memberFellowshipScope(leader), 'Shalach');
  assert.equal(memberFellowshipScope({ role: 'admin' }), undefined);
  assertFellowshipAccess(leader, 'Shalach');
  for (const fellowship of ['Pleroma', '', 'Unassigned', '%', 'Shalach,Pleroma']) {
    assert.throws(() => assertFellowshipAccess(leader, fellowship), (error: unknown) => error instanceof MemberInputError && error.status === 403);
  }
  for (const fellowship of [undefined, '', 'Unassigned', '%']) {
    assert.throws(() => memberFellowshipScope({ role: 'fellowship_leader', fellowship }));
  }
});

test('leaders may edit every personal detail but cannot transfer people into another fellowship', () => {
  assert.deepEqual(parseMemberInput({ ...valid, name: ' Ama Owusu ', cell_id: null, bsct_group_id: null }, leader), {
    ...valid, name: 'Ama Owusu', cell_id: null, bsct_group_id: null,
  });
  assert.throws(() => parseMemberInput({ ...valid, fellowship: 'Pleroma' }, leader));
  assert.throws(() => parseMemberInput({ ...valid, fellowship: 'shalach' }, leader));
  assert.throws(() => parseMemberInput({ ...valid, cell_id: 'not-a-cell' }, leader));
  assert.throws(() => parseMemberInput({ ...valid, bsct_group_id: {} }, leader));
  assert.throws(() => parseMemberInput({ ...valid, phone: {} }, leader));
  assert.equal(parseMemberInput({ ...valid, fellowship: 'Pleroma' }, { role: 'admin' }).fellowship, 'Pleroma');
});

test('breakdown includes every member once per level and keeps fellowships and cells separate', () => {
  const members = [
    { id: 'a', name: 'Ama', fellowship: 'Shalach', cell_id: 'cell1', bsct_group_id: 'bsct1' },
    { id: 'b', name: 'Esi', fellowship: 'Shalach', cell_id: 'cell1' },
    { id: 'c', name: 'Kojo', fellowship: 'Shalach' },
    { id: 'd', name: 'Yaw', fellowship: 'Shalach', cell_id: 'cell2', bsct_group_id: 'bsct2' },
    { id: 'e', name: 'Akosua', fellowship: 'Pleroma', cell_id: 'foreign' },
  ];
  const cells = [
    { id: 'cell2', fellowship: 'Shalach', number: 2, leader_member_id: null },
    { id: 'foreign', fellowship: 'Pleroma', number: 1, leader_member_id: null },
    { id: 'cell1', fellowship: 'Shalach', number: 1, leader_member_id: 'a' },
  ];
  const groups = [
    { id: 'bsct1', cell_id: 'cell1', number: 1, leader_member_id: 'a' },
    { id: 'bsct2', cell_id: 'cell2', number: 1, leader_member_id: 'd' },
  ];
  const result = fellowshipBreakdown(members, cells, groups, 'Shalach');
  assert.deepEqual(result.unassigned.map(member => member.id), ['c']);
  assert.deepEqual(result.cells.map(cell => cell.number), [1, 2]);
  assert.deepEqual(result.cells[0].members.map(member => member.id), ['a', 'b']);
  assert.deepEqual(result.cells[0].unassigned.map(member => member.id), ['b']);
  assert.deepEqual(result.cells[0].groups[0].members.map(member => member.id), ['a']);
  assert.deepEqual(result.cells[1].groups[0].members.map(member => member.id), ['d']);
  assert.equal(result.unassigned.length + result.cells.reduce((sum, cell) => sum + cell.members.length, 0), 4);
});

test('only the configured base admin qualifies for fellowship account administration', () => {
  assert.equal(isSuperAdmin({ username: 'Base', role: 'admin' }, 'base'), true);
  assert.equal(isSuperAdmin({ username: 'base', role: 'admin', accountId: 'managed-id' }, 'base'), false);
  assert.equal(isSuperAdmin({ username: 'another-admin', role: 'admin' }, 'base'), false);
  assert.equal(isSuperAdmin({ username: 'base', role: 'fellowship_leader' }, 'base'), false);
  assert.equal(isSuperAdmin(null, 'base'), false);
  assert.equal(isSuperAdmin({ username: 'base', role: 'admin' }, ''), false);
});

test('generated leader usernames are stable, distinct and valid for long or accented names', () => {
  const first = fellowshipLeaderUsername('Nana André Osei Owusu '.repeat(8), '11111111-1111-1111-1111-111111111111');
  const second = fellowshipLeaderUsername('Nana André Osei Owusu '.repeat(8), '22222222-2222-2222-2222-222222222222');
  assert.match(first, /^[a-z0-9][a-z0-9._-]{2,63}$/);
  assert.notEqual(first, second);
  assert.equal(first, fellowshipLeaderUsername('Nana André Osei Owusu '.repeat(8), '11111111-1111-1111-1111-111111111111'));
});
