import * as XLSX from 'xlsx';
import type { Member } from './database';

/** Export-only normalization; never truncate unknown or non-Ghana numbers. */
export function exportMemberPhone(phone?: string | null): string {
  const value = (phone || '').trim();
  let compact = value.replace(/^'/, '').replace(/[\s().-]/g, '');
  if (compact.startsWith('+233')) compact = compact.slice(4);
  else if (compact.startsWith('00233')) compact = compact.slice(5);
  else if (/^2330?\d{9}$/.test(compact)) compact = compact.slice(3);
  if (/^0[1-9]\d{8}$/.test(compact)) compact = compact.slice(1);
  return /^[1-9]\d{8}$/.test(compact) ? compact : value;
}

export function buildMemberExport(members: Member[]): Uint8Array<ArrayBuffer> {
  const rows = members.map(member => [
    member.id || '', member.name || '', exportMemberPhone(member.phone),
    member.fellowship || '', member.designation || '', member.birthday || '',
    member.location || '', member.created_at || '', member.updated_at || '',
    !member.phone?.trim() ? 'No phone number' : /^[1-9]\d{8}$/.test(exportMemberPhone(member.phone)) ? '' : 'Review: unrecognized format or non-Ghana number; original preserved',
  ]);
  // String cells preserve leading zeroes and cannot execute spreadsheet formulas.
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Member ID', 'Full Name', 'Phone', 'Fellowship', 'Designation', 'Birthday', 'Location', 'Created At', 'Updated At', 'Phone Format Note'],
    ...rows,
  ]);
  sheet['!cols'] = [38, 32, 20, 24, 22, 14, 28, 28, 28, 65].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: sheet['!ref']! };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Members');
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }));
}
