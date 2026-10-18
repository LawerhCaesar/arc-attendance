import assert from 'node:assert/strict';
import test from 'node:test';
import { roleAccountGroups, validateEditableRolePermissions, validateUsername, type AccessRole } from '../lib/access-management';

test('role accordions include only their managed and configured accounts, including disabled accounts', () => {
  const roles: AccessRole[] = [
    { id: 'admin-role', key: 'admin', name: 'Administrator', is_system: true, permissions: ['users'] },
    { id: 'leader-role', key: 'fellowship_leader', name: 'Fellowship Leader', is_system: true, permissions: ['members'] },
    { id: 'empty-role', key: 'custom_empty', name: 'Empty', is_system: false, permissions: ['care'] },
  ];
  const groups = roleAccountGroups(roles, [
    { id: 'one', username: 'ama', display_name: 'Ama', role_id: 'leader-role', fellowship: 'Shalach', is_active: true },
    { id: 'two', username: 'esi', display_name: 'Esi', role_id: 'admin-role', fellowship: null, is_active: false },
  ], [{ username: 'base', role: 'admin', isBaseAdmin: true }, { username: 'leader', role: 'fellowship_leader', fellowship: 'Pleroma', isBaseAdmin: false }]);
  assert.deepEqual(groups.map(group => group.count), [2, 2, 0]);
  assert.deepEqual(groups[0].accounts.map(account => account.id), ['two']);
  assert.deepEqual(groups[1].configuredAccounts.map(account => account.username), ['leader']);
  const moved = roleAccountGroups(roles, [{ id: 'one', username: 'ama', display_name: 'Ama', role_id: 'admin-role', fellowship: null, is_active: true }], []);
  assert.equal(moved[0].count, 1);
  assert.equal(moved[1].count, 0);
});

test('usernames can be reassigned and normalize consistently with sign-in', () => {
  assert.equal(validateUsername(' Ama.Owusu '), 'ama.owusu');
  for (const invalid of ['', 'ab', 'has spaces', 'x'.repeat(65), null, 123]) assert.throws(() => validateUsername(invalid));
});

test('built-in roles can change tabs while administrator and fellowship scope constraints remain', () => {
  assert.deepEqual(validateEditableRolePermissions(['care', 'members'], 'pastor'), ['care', 'members']);
  assert.deepEqual(validateEditableRolePermissions(['users', 'members'], 'admin'), ['users', 'members']);
  assert.deepEqual(validateEditableRolePermissions(['members'], 'fellowship_leader'), ['members']);
  assert.throws(() => validateEditableRolePermissions(['members'], 'admin'));
  assert.throws(() => validateEditableRolePermissions(['users'], 'custom_staff'));
  assert.throws(() => validateEditableRolePermissions(['members', 'overview'], 'fellowship_leader'));
  assert.throws(() => validateEditableRolePermissions(['users', 'unknown'], 'admin'));
});
