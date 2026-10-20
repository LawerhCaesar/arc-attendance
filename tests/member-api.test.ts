import assert from 'node:assert/strict';
import test from 'node:test';
import { memberApiFailure } from '../lib/member-api';

test('duplicate phone saves return a clear conflict without exposing other member details', async () => {
  const response = memberApiFailure({ code: '23505', details: 'Private conflicting row', message: 'This phone number is already used by another active member.' });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'This phone number is already used by another active member. Use a different number or review the existing record.' });
});

test('other unique conflicts are not misreported as phone-number conflicts', async () => {
  const response = memberApiFailure({ code: '23505', message: 'duplicate key value violates unique constraint fellowship_cells_number_key' });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'A record with these details already exists. Refresh and try again.' });
});
