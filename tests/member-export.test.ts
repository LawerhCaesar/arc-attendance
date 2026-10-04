import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { buildMemberExport, exportMemberPhone } from '../lib/member-export';

test('export normalizes Ghana phone formats to nine digits', () => {
  for (const phone of ['+233503700378', ' +233 50-370-0378 ', '0503700378',
    '233503700378', '503700378', '00233503700378', '+233 (0) 50 370 0378',
    '2330503700378', '00233 (0) 50 370 0378', '(050) 370-0378', '050.370.0378', "'0503700378"]) {
    assert.equal(exportMemberPhone(phone), '503700378', phone);
  }
  assert.equal(exportMemberPhone('0201234567'), '201234567');
  assert.equal(exportMemberPhone('0302123456'), '302123456');
});

test('unknown, incomplete, multiple and non-Ghana numbers are never silently truncated', () => {
  assert.equal(exportMemberPhone('+44503700378'), '+44503700378');
  for (const phone of ['050370', '050370037899', '0503700378 / 0201234567', 'phone 0503700378', '+503700378']) {
    assert.equal(exportMemberPhone(phone), phone);
  }
  assert.equal(exportMemberPhone(null), '');
});

test('workbook exports every member and preserves text, all details and original data', () => {
  const member = { id: 'member-1', name: '=1+1', phone: '+233503700378', fellowship: 'Shalach', designation: 'Member', birthday: '04-10', location: 'Accra', created_at: '2026-10-04', updated_at: '2026-10-04' };
  const members = Array.from({ length: 1201 }, (_, index) => ({ ...member, id: `member-${index}`, phone: index ? '0503700378' : member.phone }));
  const book = XLSX.read(buildMemberExport(members), { type: 'array' });
  const sheet = book.Sheets.Members;
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  assert.equal(rows.length, 1202);
  assert.deepEqual(rows[1], ['member-0', '=1+1', '503700378', 'Shalach', 'Member', '04-10', 'Accra', '2026-10-04', '2026-10-04', '']);
  assert.equal(sheet.C3.v, '503700378');
  assert.equal(sheet.C3.t, 's');
  assert.equal(sheet.B2.f, undefined);
  assert.equal(members[0].phone, '+233503700378');
  assert.equal(members[1].phone, '0503700378');
});

test('workbook flags numbers requiring review without losing the original', () => {
  const book = XLSX.read(buildMemberExport([{ name: 'Test', phone: 'bad number', fellowship: '', designation: '', birthday: '', location: '' }]), { type: 'array' });
  assert.equal(book.Sheets.Members.C2.v, 'bad number');
  assert.match(book.Sheets.Members.J2.v, /Review:/);
});

test('empty roster still exports column headings', () => {
  const book = XLSX.read(buildMemberExport([]), { type: 'array' });
  assert.equal(XLSX.utils.sheet_to_json(book.Sheets.Members, { header: 1 }).length, 1);
});
