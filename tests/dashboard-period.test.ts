import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardRange } from '../lib/dashboard-period';

const now = new Date('2026-09-27T12:00:00Z');
test('presets use inclusive Ghana calendar boundaries', () => {
  assert.deepEqual(dashboardRange('today', null, null, now), { start: '2026-09-27', end: '2026-09-27' });
  assert.deepEqual(dashboardRange('month', null, null, now), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(dashboardRange('ytd', null, null, now), { start: '2026-01-01', end: '2026-09-27' });
  assert.deepEqual(dashboardRange('month', null, null, new Date('2024-02-15T00:00:00Z')), { start: '2024-02-01', end: '2024-02-29' });
});

test('custom periods allow year boundaries and reject invalid or reversed dates', () => {
  assert.deepEqual(dashboardRange('custom', '2025-12-31', '2026-01-01'), { start: '2025-12-31', end: '2026-01-01' });
  assert.throws(() => dashboardRange('custom', '2026-02-30', '2026-03-01'));
  assert.throws(() => dashboardRange('custom', '2026-09-28', '2026-09-27'));
  assert.throws(() => dashboardRange('custom', '', '2026-09-27'));
  assert.throws(() => dashboardRange('unknown'));
});
