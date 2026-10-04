import * as XLSX from 'xlsx';
import type { Member } from './database';

/** Export-only transformation: leave local and other international numbers alone. */
export function exportMemberPhone(phone?: string | null): string {
  const value = (phone || '').trim();
  return value.startsWith('+233') ? value.slice(4).replace(/[\s()-]/g, '') : value;
}

export function buildMemberExport(members: Member[]): Uint8Array<ArrayBuffer> {
  const rows = members.map(member => [
    member.id || '', member.name || '', exportMemberPhone(member.phone),
    member.fellowship || '', member.designation || '', member.birthday || '',
    member.location || '', member.created_at || '', member.updated_at || '',
  ]);
  // String cells preserve leading zeroes and cannot execute spreadsheet formulas.
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Member ID', 'Full Name', 'Phone', 'Fellowship', 'Designation', 'Birthday', 'Location', 'Created At', 'Updated At'],
    ...rows,
  ]);
  sheet['!cols'] = [38, 32, 20, 24, 22, 14, 28, 28, 28].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: sheet['!ref']! };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Members');
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }));
}
