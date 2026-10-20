import { normalizeDuplicatePhone } from './member-duplicates';

const GSM = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXTENDED = new Set(Array.from('^{}\\[~]|€\f'));
export function smsMessageInfo(text: string) {
  const unicode = Array.from(text).some(character => !GSM.has(character) && !EXTENDED.has(character));
  const units = unicode ? text.length : Array.from(text).reduce((sum, character) => sum + (EXTENDED.has(character) ? 2 : 1), 0);
  const single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  return { encoding: unicode ? 'Unicode' : 'GSM-7', type: unicode ? 1 : 0, units, segments: units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi) };
}
export function validateSmsMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1600 || /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(value)) throw new Error('Enter a message of up to 1,600 characters without control characters.');
  return value.trim();
}
export interface SmsRosterMember { id: string; name: string; phone?: string | null; fellowship: string; is_active?: boolean; merged_into_id?: string | null }
export interface BulkSmsRecipient { memberId: string; name: string; phone: string; fellowship: string }
export function bulkSmsRecipients(members: SmsRosterMember[], fellowship: string | null) {
  const phones = new Set<string>();
  const recipients: BulkSmsRecipient[] = [];
  let missingPhone = 0, duplicatePhone = 0;
  for (const member of members) {
    if (member.is_active === false || member.merged_into_id || (fellowship !== null && member.fellowship !== fellowship)) continue;
    const phone = normalizeDuplicatePhone(member.phone);
    if (!phone) { missingPhone++; continue; }
    if (phones.has(phone)) { duplicatePhone++; continue; }
    phones.add(phone);
    recipients.push({ memberId: member.id, name: member.name, phone: `+${phone}`, fellowship: member.fellowship });
  }
  return { recipients, missingPhone, duplicatePhone };
}
export type SmsOutcome = { phone: string; status: 'accepted' | 'rejected' | 'uncertain' | 'skipped'; messageId?: string };
export interface BulkSmsCampaign {
  id: string; created_by: string; sent_by: string | null; fellowship: string | null; message: string; sender: string;
  recipient_count: number; segments: number; encoding: string; missing_phone: number; duplicate_phone: number;
  status: 'draft' | 'ready' | 'sending' | 'completed' | 'uncertain'; next_offset: number;
  accepted: number; rejected: number; uncertain: number; skipped: number; created_at: string; updated_at: string;
}
export const campaignColumns = 'id,created_by,sent_by,fellowship,message,sender,recipient_count,segments,encoding,missing_phone,duplicate_phone,status,next_offset,accepted,rejected,uncertain,skipped,created_at,updated_at';
export const SMS_BATCH_SIZE = 250;
