import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthContext } from '../lib/auth';
import { canAssignCare, canReadCare, hasFellowshipCare } from '../lib/care-access';

const leader: AuthContext = { username: 'shalach', role: 'fellowship_leader', permissions: ['members'], fellowship: 'Shalach' };
test('leaders get fellowship care through roster access without church-wide overview permissions', () => {
  assert.equal(hasFellowshipCare(leader), true);
  assert.equal(canReadCare(leader), true);
  assert.equal(canAssignCare(leader), true);
  for (const fellowship of [undefined, 'Unknown fellowship']) {
    assert.equal(canReadCare({ ...leader, fellowship }), false);
    assert.equal(canAssignCare({ ...leader, fellowship }), false);
  }
  assert.equal(canReadCare({ ...leader, permissions: ['overview'] }), false);
  assert.equal(canAssignCare({ ...leader, permissions: ['care'] }), false);
});
test('existing assigned-only care staff cannot assign tasks or gain overview access', () => {
  const staff: AuthContext = { username: 'helper', role: 'helper', permissions: ['care'] };
  assert.equal(canReadCare(staff), true);
  assert.equal(canAssignCare(staff), false);
  assert.equal(canAssignCare({ ...staff, permissions: ['overview'] }), true);
  assert.equal(canReadCare(null), false);
});
