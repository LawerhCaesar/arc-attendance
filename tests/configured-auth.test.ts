import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import { DEFAULT_PERMISSIONS } from '../lib/permissions';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth-tests.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
process.env.ADMIN_USERNAME = 'test-base-admin';
let auth: typeof import('../lib/auth');
const originalFetch = globalThis.fetch;
before(async () => { auth = await import('../lib/auth'); });
afterEach(() => { globalThis.fetch = originalFetch; });
const staff = { username: 'configured-pastor', password: 'old-password', role: 'pastor' as const };

const fixture = (hasOverride: boolean, username = 'configured-pastor') => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const accountRequest = url.pathname.endsWith('/staff_accounts');
    if (accountRequest) assert.equal(url.searchParams.get('configured_username'), `eq.${username}`);
    const rows = accountRequest ? hasOverride ? [{ id: 'managed-override', is_active: false }] : [] : [{ permissions: ['members'] }];
    const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singular ? rows[0] : rows), { headers: { 'Content-Type': 'application/json' } });
  };
};

test('configured staff accounts use the current permissions of their role', async () => {
  fixture(false);
  const context = await auth.configuredAuthContext(staff);
  assert.deepEqual(context?.permissions, ['members']);
});

test('a managed override retires the original login even if renamed or disabled', async () => {
  fixture(true);
  assert.equal(await auth.configuredAuthContext(staff), null);
});

test('account service failures never restore old configured credentials', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(auth.configuredAuthContext(staff));
});

test('the base administrator retains full access until its configured credentials are retired', async () => {
  const base = { username: 'test-base-admin', password: 'recovery', role: 'admin' as const };
  fixture(false, base.username);
  assert.deepEqual((await auth.configuredAuthContext(base))?.permissions, DEFAULT_PERMISSIONS.admin);
  fixture(true, base.username);
  assert.equal(await auth.configuredAuthContext(base), null);
  globalThis.fetch = async () => { throw new Error('Unavailable'); };
  await assert.rejects(auth.configuredAuthContext(base));
});
