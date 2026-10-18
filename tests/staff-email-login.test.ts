import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import { DEFAULT_PERMISSIONS } from '../lib/permissions';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://email-auth-tests.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
process.env.ADMIN_USERNAME = 'base-admin';
process.env.ADMIN_PASSWORD = 'recovery-password';
process.env.ADMIN_EMAIL = 'base@example.com';
process.env.APP_USERS_JSON = JSON.stringify([{ username: 'configured-leader', email: 'configured@example.com', password: 'configured-password', role: 'fellowship_leader', fellowship: 'Shalach' }]);
let login: typeof import('../lib/staff-login');
const originalFetch = globalThis.fetch;
before(async () => { login = await import('../lib/staff-login'); });
afterEach(() => { globalThis.fetch = originalFetch; });
const account = { id: 'managed-id', username: 'ama', password_hash: 'fixture-password', role_id: 'leader-role', fellowship: 'Shalach', is_active: true, session_version: 2 };
function fixture(active = true, hasOverride = false) {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let rows: unknown[];
    if (url.pathname.endsWith('/staff_account_contacts')) rows = [];
    else if (url.pathname.endsWith('/staff_accounts')) {
      if (url.searchParams.has('configured_username')) rows = hasOverride ? [{ id: 'override' }] : [];
      else rows = ['eq.ama', 'eq.ama@example.com'].includes(url.searchParams.get('username') || url.searchParams.get('email') || '') ? [{ ...account, is_active: active }] : [];
    } else rows = [{ key: 'fellowship_leader', permissions: ['members'] }];
    const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singular ? rows[0] : rows), { headers: { 'Content-Type': 'application/json' } });
  };
}

test('managed accounts can use email or username with the same password and scoped permissions', async () => {
  fixture();
  const byEmail = await login.authenticateStaffLogin(' AMA@EXAMPLE.COM ', 'fixture-password');
  const byUsername = await login.authenticateStaffLogin('ama', 'fixture-password');
  assert.deepEqual(byEmail, byUsername);
  assert.equal(byEmail?.username, 'ama');
  assert.equal(byEmail?.fellowship, 'Shalach');
  assert.deepEqual(byEmail?.permissions, ['members']);
  assert.equal(await login.authenticateStaffLogin('ama@example.com', 'wrong-password'), null);
  assert.equal(await login.authenticateStaffLogin('unknown@example.com', 'fixture-password'), null);
});

test('disabled accounts cannot sign in with their email', async () => {
  fixture(false);
  assert.equal(await login.authenticateStaffLogin('ama@example.com', 'fixture-password'), null);
});

test('configured email sign-in is retired by a managed override, including disabled overrides', async () => {
  fixture();
  assert.equal((await login.authenticateStaffLogin('configured@example.com', 'configured-password'))?.username, 'configured-leader');
  fixture(true, true);
  assert.equal(await login.authenticateStaffLogin('configured@example.com', 'configured-password'), null);
});

test('base admin username and email stop working after its managed profile replaces the configured login', async () => {
  fixture();
  assert.equal((await login.authenticateStaffLogin(' BASE@EXAMPLE.COM ', 'recovery-password'))?.username, 'base-admin');
  assert.equal((await login.authenticateStaffLogin('base-admin', 'recovery-password'))?.username, 'base-admin');
  fixture(true, true);
  assert.equal(await login.authenticateStaffLogin('base-admin', 'recovery-password'), null);
  assert.equal(await login.authenticateStaffLogin('base@example.com', 'recovery-password'), null);
  globalThis.fetch = async () => { throw new Error('Unavailable'); };
  await assert.rejects(login.authenticateStaffLogin('base-admin', 'recovery-password'));
});

test('renamed managed base administrator retains full permissions from its immutable identity', async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const rows = url.pathname.endsWith('/staff_accounts')
      ? [{ ...account, username: 'renamed-base', configured_username: 'base-admin' }]
      : [{ key: 'admin', permissions: ['users'] }];
    const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singular ? rows[0] : rows), { headers: { 'Content-Type': 'application/json' } });
  };
  const context = await login.authenticateStaffLogin('renamed-base', 'fixture-password');
  assert.equal(context?.configuredUsername, 'base-admin');
  assert.deepEqual(context?.permissions, DEFAULT_PERMISSIONS.admin);
});
