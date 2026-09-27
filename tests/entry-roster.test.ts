import assert from 'node:assert/strict';
import test from 'node:test';
import { entryMetrics, reconcileEntryRoster, type EntryDraft } from '../lib/entry-roster';

const entry = (id: string, name = 'Member', extra: Partial<EntryDraft> = {}): EntryDraft => ({
  id, name, phone: '', location: '', birthday: '', fellowship: 'All Grace', designation: 'Member', firstTimer: false, ...extra,
});
const memberId = '00000000-0000-4000-8000-000000000001';
const mergedId = '00000000-0000-4000-8000-000000000002';

test('old cached roster is replaced by active members while drafts and valid selections survive', () => {
  const current = [entry(memberId, 'Current name')];
  const cached = [entry(memberId, 'Old name'), entry(mergedId), entry('draft', 'Visitor'), entry('blank', '', { fellowship: '' })];
  const result = reconcileEntryRoster(current, cached, new Set([memberId, mergedId, 'draft', 'blank', 'ghost']));
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries.find(row => row.id === memberId)?.name, 'Current name');
  assert.deepEqual([...result.marked].sort(), [memberId, 'draft'].sort());
  assert.deepEqual(result.removed.map(row => row.id), [mergedId]);
});

test('explicit unsaved roster edits survive refresh and remain linked to the roster', () => {
  const result = reconcileEntryRoster([entry(memberId)], [entry(memberId, 'Edited name', { dirty: true, phone: '0241111111' })], new Set([memberId]));
  assert.equal(result.entries[0].name, 'Edited name');
  assert.equal(result.entries[0].rosterMemberId, memberId);
  assert.equal(result.entries[0].phone, '0241111111');
});

test('blank rows and removed selection IDs never inflate the submit count', () => {
  const result = entryMetrics([entry('a'), entry('b', ''), entry('c', '  ')], new Set(['a', 'b', 'c', 'ghost']));
  assert.deepEqual(result, { people: 1, blankRows: 2, selected: 1 });
});

test('empty active roster removes stale members without dropping named visitor drafts', () => {
  const result = reconcileEntryRoster([], [entry(mergedId), entry('draft', 'Visitor')], new Set([mergedId, 'draft']));
  assert.deepEqual(result.entries.map(row => row.id), ['draft']);
  assert.deepEqual([...result.marked], ['draft']);
});
