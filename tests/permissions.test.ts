import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccess, DEFAULT_PERMISSIONS, homeForPermissions, validateRolePermissions, validateNewPassword } from '../lib/permissions';

test('tab permissions deny unassigned endpoints and never infer privileges from a custom role name', () => {
  const welfare = { role: 'custom_welfare', permissions: ['welfare'] };
  assert.equal(canAccess(welfare, 'welfare'), true);
  for (const denied of ['users', 'members', 'raw-data', 'overview', 'first-timers'] as const) assert.equal(canAccess(welfare, denied), false);
  assert.equal(canAccess(null, 'welfare'), false);
  assert.equal(canAccess({ role: 'admin', permissions: [] }, 'users'), false);
});

test('role definitions cannot grant the protected account-management tab or unknown privileges', () => {
  assert.deepEqual(validateRolePermissions(['welfare', 'welfare', 'first-timers']), ['welfare', 'first-timers']);
  for (const invalid of [[], ['users'], ['*'], ['admin'], null, 'members']) assert.throws(() => validateRolePermissions(invalid));
});

test('built-in defaults preserve departments and restrict account management to administrators', () => {
  assert.ok(DEFAULT_PERMISSIONS.admin.includes('users'));
  assert.ok(!DEFAULT_PERMISSIONS.pastor.includes('users'));
  assert.deepEqual(DEFAULT_PERMISSIONS.welfare, ['welfare']);
  assert.deepEqual(DEFAULT_PERMISSIONS.first_timers, ['first-timers']);
  assert.deepEqual(DEFAULT_PERMISSIONS.fellowship_leader, ['entry']);
  assert.equal(homeForPermissions({ role: 'custom', permissions: ['welfare'] }), '/admin');
  assert.equal(homeForPermissions({ role: 'fellowship_leader', permissions: ['entry'] }), '/entry');
});

test('password policy prevents short passwords and bcrypt byte truncation', () => {
  assert.equal(validateNewPassword('a-long-unique-password'), 'a-long-unique-password');
  assert.throws(() => validateNewPassword('short'));
  assert.throws(() => validateNewPassword('x'.repeat(73)));
  assert.throws(() => validateNewPassword('🎂'.repeat(19)));
  assert.throws(() => validateNewPassword(null));
});
