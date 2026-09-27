import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAllRows } from '../lib/pagination';

test('loads records beyond the Supabase cap without omitting tied sort values', async () => {
  const expected = Array.from({ length: 2897 }, (_, id) => ({ id, name: 'Repeated name' }));
  const actual = await fetchAllRows(async (from, to) => ({ data: expected.slice(from, to + 1), error: null }));
  assert.deepEqual(actual, expected);
});

test('rejects a failed later page instead of returning a partial dashboard', async () => {
  await assert.rejects(fetchAllRows(async from => from === 0
    ? { data: Array(500).fill(1), error: null }
    : { data: null, error: { message: 'Database unavailable' } }), /Database unavailable/);
});
