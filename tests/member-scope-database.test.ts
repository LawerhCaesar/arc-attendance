import assert from 'node:assert/strict';
import test, { before, afterEach } from 'node:test';
import type { Member } from '../lib/database';

// Exercise the real Supabase query builders against a local in-memory REST
// fixture. A missing fellowship filter would actually mutate the foreign row.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://scope-tests.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
let database: typeof import('../lib/database');
const originalFetch = globalThis.fetch;
before(async () => { database = await import('../lib/database'); });
afterEach(() => { globalThis.fetch = originalFetch; });

const fixture = () => {
  const rows: Member[] = [
    { id: 'own', name: 'Ama', phone: '0241234567', fellowship: 'Shalach', designation: 'Member', birthday: '', location: '', is_active: true },
    { id: 'foreign', name: 'Esi', phone: '0551234567', fellowship: 'Pleroma', designation: 'Member', birthday: '', location: '', is_active: true },
  ];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/rest/v1/members');
    let selected = rows.filter(row => [...url.searchParams.entries()].every(([field, filter]) => {
      if (!filter.startsWith('eq.')) return true;
      return String(row[field as keyof Member]) === filter.slice(3);
    }));
    if (init?.method === 'PATCH') selected.forEach(row => Object.assign(row, JSON.parse(String(init.body))));
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      selected = (Array.isArray(body) ? body : [body]).map((row: Member) => ({ ...row, id: `new-${rows.length}` }));
      rows.push(...selected);
    }
    const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singular ? selected[0] || null : selected), { headers: { 'Content-Type': 'application/json' } });
  };
  return rows;
};

test('member reads are scoped to the leader fellowship', async () => {
  fixture();
  assert.deepEqual((await database.getMembers(undefined, 'Shalach')).map(member => member.id), ['own']);
});

test('the details editor can load only active members in its permitted fellowship', async () => {
  const rows = fixture();
  assert.equal((await database.getMember('own', 'Shalach'))?.name, 'Ama');
  assert.equal(await database.getMember('foreign', 'Shalach'), null);
  rows[0].is_active = false;
  assert.equal(await database.getMember('own', 'Shalach'), null);
  assert.equal((await database.getMember('foreign'))?.name, 'Esi');
});

test('editing or removing a guessed foreign member ID cannot affect another fellowship', async () => {
  const rows = fixture();
  assert.equal(await database.updateMember('foreign', { name: 'Changed', fellowship: 'Shalach' }, 'Shalach'), null);
  assert.equal(await database.deleteMember('foreign', 'Shalach'), false);
  assert.equal(rows[1].name, 'Esi');
  assert.equal(rows[1].fellowship, 'Pleroma');
  assert.equal(rows[1].is_active, true);
});

test('leaders can edit personal details and membership of their own brethren', async () => {
  fixture();
  const updated = await database.updateMember('own', { name: 'Ama Owusu', phone: '0209876543', location: 'Tema', birthday: '04-10', designation: 'BSCT Leader', cell_id: 'cell', bsct_group_id: 'bsct' }, 'Shalach');
  assert.equal(updated?.name, 'Ama Owusu');
  assert.equal(updated?.location, 'Tema');
  assert.equal(updated?.cell_id, 'cell');
  assert.equal(updated?.bsct_group_id, 'bsct');
});

test('importing a shared phone never updates someone in another fellowship', async () => {
  const rows = fixture();
  await database.syncMemberFromAttendance({ date: '2026-10-18', name: 'Kojo', phone: '0551234567', fellowship: 'Shalach', designation: 'Cell Leader', location: 'Tema', birthday: '', firstTimer: 'No' }, undefined, 'Shalach');
  assert.equal(rows.length, 3);
  assert.equal(rows[1].name, 'Esi');
  assert.equal(rows[1].designation, 'Member');
  assert.equal(rows[1].location, '');
  assert.equal(rows[2].fellowship, 'Shalach');
});

test('roster imports submit one atomic insert and preserve database phone conflicts', async () => {
  let requests = 0;
  globalThis.fetch = async (_input, init) => {
    requests++;
    assert.equal(init?.method, 'POST');
    const rows = JSON.parse(String(init?.body));
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row: Member) => row.is_active === true));
    return new Response(JSON.stringify({ code: '23505', message: 'Duplicate phone' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  };
  const input = { name: 'Synthetic', phone: '0503700378', fellowship: 'Shalach', designation: 'Member', birthday: '', location: '' };
  await assert.rejects(database.createMembers([input, { ...input, name: 'Other', phone: '+233503700378' }]), (error: { code?: string }) => error.code === '23505');
  assert.equal(requests, 1);
});
