import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import { NextRequest } from 'next/server';
import { dateInAccra } from '../lib/birthdays';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://reminder-tests.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
process.env.CRON_SECRET = 'fixture-cron';
process.env.RESEND_API_KEY = 'fixture-email-key';
process.env.BIRTHDAY_REMINDER_FROM = 'ARC <birthdays@example.com>';
process.env.BIRTHDAY_REMINDER_TO = 'office@example.com';
delete process.env.APP_USERS_JSON;
let cron: typeof import('../app/api/cron/birthday-reminders/route');
const originalFetch = globalThis.fetch;
before(async () => { cron = await import('../app/api/cron/birthday-reminders/route'); });
afterEach(() => { globalThis.fetch = originalFetch; });
const request = () => new NextRequest('http://localhost/api/cron/birthday-reminders', { headers: { authorization: 'Bearer fixture-cron' } });

function fixture(options: { providerFailure?: boolean; historyFailure?: boolean; rosterFailure?: boolean } = {}) {
  const sent: { recipient: string; key: string; body: Record<string, unknown> }[] = [];
  const history = new Set<string>();
  const nextWeek = new Date(`${dateInAccra()}T00:00:00Z`); nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.resend.com') {
      const body = JSON.parse(String(init?.body));
      sent.push({ recipient: body.to[0], key: new Headers(init?.headers).get('Idempotency-Key')!, body });
      return new Response(JSON.stringify(options.providerFailure ? { error: 'Unavailable' } : { id: `email-${sent.length}` }), { status: options.providerFailure ? 503 : 200 });
    }
    let rows: unknown[] = [];
    if (url.pathname.endsWith('/members')) {
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      assert.ok(!url.searchParams.get('select')?.includes('phone'));
      if (options.rosterFailure) return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 500 });
      rows = [{ id: 'member-one', name: 'A <Member>', fellowship: 'Shalach', birthday: nextWeek.toISOString().slice(0, 10) }];
    } else if (url.pathname.endsWith('/staff_accounts')) rows = [
      { email: 'leader@example.com', fellowship: 'Shalach', role_id: 'leader-role', is_active: true, configured_username: null },
      { email: 'other@example.com', fellowship: 'Pleroma', role_id: 'leader-role', is_active: true, configured_username: null },
    ];
    else if (url.pathname.endsWith('/staff_roles')) rows = [{ id: 'leader-role', key: 'fellowship_leader' }, { id: 'admin-role', key: 'admin' }];
    else if (url.pathname.endsWith('/staff_account_contacts')) rows = [];
    else if (url.pathname.endsWith('/notification_deliveries')) {
      if (init?.method === 'POST') {
        history.add(JSON.parse(String(init.body)).recipient);
        return new Response(null, { status: 201 });
      }
      assert.equal(url.searchParams.get('status'), 'eq.sent');
      if (options.historyFailure) return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 500 });
      rows = history.has(url.searchParams.get('recipient')!.slice(3)) ? [{ id: 'sent' }] : [];
    } else throw new Error(`Unexpected request: ${url.pathname}`);
    const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singular ? rows[0] : rows), { headers: { 'Content-Type': 'application/json' } });
  };
  return { sent, history };
}

test('cron sends private per-recipient emails only to the member fellowship and central office, then skips sent deliveries', async () => {
  const { sent } = fixture();
  const response = await cron.GET(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent, 2);
  assert.deepEqual(sent.map(email => email.recipient).sort(), ['leader@example.com', 'office@example.com']);
  assert.notEqual(sent[0].key, sent[1].key);
  for (const email of sent) {
    assert.equal((email.body.to as string[]).length, 1);
    assert.equal(email.body.cc, undefined);
    assert.ok(String(email.body.html).includes('A &lt;Member&gt;'));
  }
  const repeated = await cron.GET(request());
  assert.equal((await repeated.json()).skipped, 2);
  assert.equal(sent.length, 2);
});

test('provider failures do not record successful delivery and fail the run', async () => {
  const { history } = fixture({ providerFailure: true });
  const response = await cron.GET(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).sent, 0);
  assert.equal(history.size, 0);
});

test('history and roster failures cannot cause an untracked or incorrectly scoped email', async () => {
  let calls = fixture({ historyFailure: true });
  assert.equal((await cron.GET(request())).status, 502);
  assert.equal(calls.sent.length, 0);
  calls = fixture({ rosterFailure: true });
  assert.equal((await cron.GET(request())).status, 503);
  assert.equal(calls.sent.length, 0);
});

test('the birthday cron rejects unauthorized callers before loading or sending data', async () => {
  globalThis.fetch = async () => { throw new Error('Unauthorized cron must not access external services'); };
  assert.equal((await cron.GET(new NextRequest('http://localhost/api/cron/birthday-reminders'))).status, 401);
});
