import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { assignUnassignedMember, listUnassignedMembers } from '../lib/unassigned-members';
import { loadFellowshipHistoryRows } from '../lib/fellowship-history-source';
import { fellowshipAttendanceReport } from '../lib/fellowship-insights';
import { rosterAttendanceSummary } from '../lib/roster-attendance';

const id = '11111111-1111-4111-8111-111111111111';
const candidate = { id, name: 'Ama Test', phone: '0201234567', location: 'Tema', birthday: '02-10',
  designation: 'Member', fellowship: 'Unassigned', is_active: true, merged_into_id: null, cell_id: null, bsct_group_id: null };

function fixture() {
  const members = [candidate, { ...candidate, id: '22222222-2222-4222-8222-222222222222', fellowship: 'Pleroma' },
    { ...candidate, id: '33333333-3333-4333-8333-333333333333', is_active: false },
    { ...candidate, id: '44444444-4444-4444-8444-444444444444', merged_into_id: id }].map(member => ({ ...member }));
  const attendance = [{ id: 'history', member_id: id, name: candidate.name, phone: candidate.phone, fellowship: 'Unassigned',
    date: '2026-10-25', attendanceDate: '2026-10-25', attendanceStatus: 'present' },
    { id: 'foreign-history', member_id: members[1].id, name: candidate.name, phone: candidate.phone, fellowship: 'Unassigned',
      date: '2026-10-18', attendanceDate: '2026-10-18', attendanceStatus: 'present' }];
  let calls = 0;
  const client = createClient('https://fixture.supabase.co', 'synthetic-service-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
      calls++;
      const url = new URL(String(input));
      const table = url.pathname.split('/').at(-1);
      assert.ok(table === 'members' || table === 'attendance');
      if (table === 'attendance') assert.notEqual(init?.method, 'PATCH', 'Historic attendance must not be rewritten');
      const rows = table === 'members' ? members : attendance;
      const selected = rows.filter(row => [...url.searchParams].every(([field, filter]) => {
        const value = row[field as keyof typeof row];
        if (filter.startsWith('eq.')) return String(value) === filter.slice(3);
        if (filter === 'is.null') return value === null;
        if (filter.startsWith('in.')) return filter.slice(4, -1).split(',').includes(String(value));
        return true;
      }));
      if (init?.method === 'PATCH') selected.forEach(row => Object.assign(row, JSON.parse(String(init.body))));
      const columns = url.searchParams.get('select');
      const projected = selected.map(row => columns && columns !== '*' ? Object.fromEntries(columns.split(',').map(key => [key, row[key as keyof typeof row]])) : row);
      const singular = new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');
      return new Response(JSON.stringify(singular ? projected[0] || null : projected), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return { client, members, attendance, calls: () => calls };
}

test('unassigned picker exposes only active unmerged candidates and limited identifying details', async () => {
  const { client } = fixture();
  assert.deepEqual(await listUnassignedMembers(client), [{ id, name: candidate.name, phone: candidate.phone, location: candidate.location, designation: 'Member' }]);
});

test('assignment moves the existing member without changing their details or stored attendance', async () => {
  const { client, attendance, members } = fixture();
  const originalAttendance = structuredClone(attendance);
  const saved = await assignUnassignedMember(client, id, 'Shalach');
  assert.equal(saved.id, id);
  assert.equal(saved.fellowship, 'Shalach');
  assert.equal(saved.birthday, candidate.birthday);
  assert.equal(saved.phone, candidate.phone);
  assert.equal(members.length, 4);
  assert.deepEqual(attendance, originalAttendance);
  assert.deepEqual(await listUnassignedMembers(client), []);
});

test('foreign, archived and merged IDs cannot be claimed, and repeated/concurrent claims have one winner', async () => {
  const { client, members } = fixture();
  for (const member of members.slice(1)) await assert.rejects(assignUnassignedMember(client, member.id, 'Shalach'), { status: 409 });
  const results = await Promise.allSettled([assignUnassignedMember(client, id, 'Shalach'), assignUnassignedMember(client, id, 'Enthroned')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.ok(['Shalach', 'Enthroned'].includes(members[0].fellowship));
  await assert.rejects(assignUnassignedMember(client, id, 'Shalach'), { status: 409 });
  assert.equal(members[1].fellowship, 'Pleroma');
  assert.equal(members[2].is_active, false);
});

test('invalid IDs and destinations are rejected before contacting the database', async () => {
  const { client, calls } = fixture();
  for (const invalid of [undefined, {}, 'not-an-id']) await assert.rejects(assignUnassignedMember(client, invalid, 'Shalach'), { status: 400 });
  for (const invalid of ['Unassigned', '', 'Shalach,Pleroma']) await assert.rejects(assignUnassignedMember(client, id, invalid), { status: 403 });
  assert.equal(calls(), 0);
});

test('claimed brethren retain linked Unassigned history and colors without exposing another member sharing a phone', async () => {
  const { client, members, attendance } = fixture();
  await assignUnassignedMember(client, id, 'Shalach');
  const roster = members.filter(member => member.fellowship === 'Shalach');
  const rows = await loadFellowshipHistoryRows(client, roster, 'Shalach');
  assert.deepEqual(rows.map(row => row.id), ['history']);
  const history = fellowshipAttendanceReport(roster, rows, 'Shalach', '2026-10-27');
  assert.deepEqual(history.members[0].history, [{ date: '2026-10-25', status: 'present' }]);
  assert.equal(rosterAttendanceSummary(roster, rows, attendance, '2026-10-27').members[id].attended, 1);
  const unlinked = { ...attendance[0], id: 'legacy', member_id: null, attendanceDate: '2026-10-11' };
  assert.equal(fellowshipAttendanceReport(roster, [...rows, unlinked], 'Shalach', '2026-10-27').members[0].history.length, 1);
});
