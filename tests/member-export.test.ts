import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { buildMemberExport, exportMemberPhone } from '../lib/member-export';

test('export removes only the Ghana international prefix without adding a zero', () => {
  assert.equal(exportMemberPhone('+233503700378'), '503700378');
  assert.equal(exportMemberPhone(' +233 50-370-0378 '), '503700378');
  assert.equal(exportMemberPhone('0503700378'), '0503700378');
  assert.equal(exportMemberPhone('+44503700378'), '+44503700378');
  assert.equal(exportMemberPhone('233503700378'), '233503700378');
  assert.equal(exportMemberPhone(null), '');
});

test('workbook exports every member and preserves text, all details and original data', () => {
  const member = { id: 'member-1', name: '=1+1', phone: '+233503700378', fellowship: 'Shalach', designation: 'Member', birthday: '04-10', location: 'Accra', created_at: '2026-10-04', updated_at: '2026-10-04' };
  const members = Array.from({ length: 1201 }, (_, index) => ({ ...member, id: `member-${index}`, phone: index ? '0503700378' : member.phone }));
  const book = XLSX.read(buildMemberExport(members), { type: 'array' });
  const sheet = book.Sheets.Members;
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  assert.equal(rows.length, 1202);
  assert.deepEqual(rows[1], ['member-0', '=1+1', '503700378', 'Shalach', 'Member', '04-10', 'Accra', '2026-10-04', '2026-10-04']);
  assert.equal(sheet.C3.v, '0503700378');
  assert.equal(sheet.C3.t, 's');
  assert.equal(sheet.B2.f, undefined);
  assert.equal(members[0].phone, '+233503700378');
});

test('empty roster still exports column headings', () => {
  const book = XLSX.read(buildMemberExport([]), { type: 'array' });
  assert.equal(XLSX.utils.sheet_to_json(book.Sheets.Members, { header: 1 }).length, 1);
});
