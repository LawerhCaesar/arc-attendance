import { normalizeDuplicatePhone } from './member-duplicates';
export function validateAccountPhone(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Enter a valid phone number for SMS.');
  if (!value.trim()) return null;
  const phone = normalizeDuplicatePhone(value);
  if (!phone) throw new Error('Enter a valid phone number, including its country code for numbers outside Ghana.');
  return `+${phone}`;
}
