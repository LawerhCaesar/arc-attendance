import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import type { AuthContext } from '../lib/auth';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://profile-tests.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service';
process.env.ADMIN_USERNAME = 'base-admin';
process.env.ADMIN_PASSWORD = 'fixture-password';
process.env.ADMIN_EMAIL = 'original@example.com';
delete process.env.APP_USERS_JSON;
let profiles: typeof import('../lib/account-profile');
let login: typeof import('../lib/staff-login');
let admin: ReturnType<typeof import('../lib/supabase-admin').getSupabaseAdmin>;
const originalFetch = globalThis.fetch;
before(async () => {
  profiles = await import('../lib/account-profile');
  login = await import('../lib/staff-login');
  admin = (await import('../lib/supabase-admin')).getSupabaseAdmin();
});
afterEach(() => { globalThis.fetch = originalFetch; });
const leader: AuthContext = { username: 'leader', role: 'fellowship_leader', fellowship: 'Shalach', permissions: ['members'], accountId: 'own-account', sessionVersion: 1 };
const base: AuthContext = { username: 'base-admin', role: 'admin', permissions: ['users'] };

function fixture(savedEmail: string | null = null) {
  const writes: { path: string; body: Record<string, unknown>; target: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let rows: unknown[] = [];
    if (init?.method === 'PATCH' || init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      writes.push({ path: url.pathname, body, target: url.searchParams.get('id') });
      if (url.pathname.endsWith('/staff_account_contacts')) savedEmail = body.email;
      else rows = [{ email: body.email, session_version: 2 }];
    } else if (url.pathname.endsWith('/staff_account_contacts')) {
      rows = savedEmail ? [{ configured_username: 'base-admin', email: savedEmail }] : [];
    } else if (url.pathname.endsWith('/staff_accounts')) rows = [{ display_name: 'Leader', email: 'leader@example.com', configured_username: null }];
    const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singular ? rows[0] : rows), { headers: { 'Content-Type': 'application/json' } });
  };
  return writes;
}

test('self-service email edits target only the managed account from the session and refresh its version', async () => {
  const writes = fixture();
  assert.deepEqual(await profiles.saveOwnAccountEmail(admin!, leader, ' NEW@EXAMPLE.COM '), { email: 'new@example.com', sessionVersion: 2 });
  assert.deepEqual(writes, [{ path: '/rest/v1/staff_accounts', body: { email: 'new@example.com' }, target: 'eq.own-account' }]);
});

test('base admin saves its own address without changing its recovery account, password or role', async () => {
  const writes = fixture();
  await profiles.saveOwnAccountEmail(admin!, base, 'admin@example.com');
  assert.equal(writes[0].path, '/rest/v1/staff_account_contacts');
  assert.equal(writes[0].body.configured_username, 'base-admin');
  assert.equal(writes[0].body.email, 'admin@example.com');
  assert.equal(writes[0].body.role_id, undefined);
  assert.equal(writes[0].body.password_hash, undefined);
  assert.equal((await profiles.ownAccountProfile(admin!, base)).email, 'admin@example.com');
});

test('saved configured email replaces the original alias and supports base admin email sign-in', async () => {
  fixture('admin@example.com');
  assert.equal((await login.authenticateStaffLogin('admin@example.com', 'fixture-password'))?.username, 'base-admin');
  assert.equal(await login.authenticateStaffLogin('original@example.com', 'fixture-password'), null);
});

test('a leader cannot claim another configured account email or submit invalid addresses', async () => {
  const writes = fixture('admin@example.com');
  await assert.rejects(profiles.saveOwnAccountEmail(admin!, leader, 'admin@example.com'), /already assigned/);
  await assert.rejects(profiles.saveOwnAccountEmail(admin!, leader, ''), /Enter an email/);
  assert.equal(writes.length, 0);
});
