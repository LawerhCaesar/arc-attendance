import { normalizeDuplicatePhone } from './member-duplicates';

const GSM = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXTENDED = new Set(Array.from('^{}\\[~]|€\f'));
// Common phone/word-processor typography has a plain GSM equivalent. Keep
// language-specific letters and emoji intact rather than losing their meaning.
export function standardSmsPunctuation(text: string): string {
  return text.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-').replace(/…/g, '...')
    .replace(/[\u00a0\u2007\u202f]/g, ' ');
}
export function smsMessageInfo(text: string) {
  const characters = Array.from(text);
  const unicodeCharacters = [...new Set(characters.filter(character => !GSM.has(character) && !EXTENDED.has(character)))];
  const unicode = unicodeCharacters.length > 0;
  const costs = characters.map(character => unicode ? character.length : EXTENDED.has(character) ? 2 : 1);
  const units = costs.reduce((sum, cost) => sum + cost, 0);
  const single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  let segments = units === 0 ? 0 : 1, used = 0;
  if (units > single) {
    for (const cost of costs) {
      if (used + cost > multi) { segments++; used = 0; }
      used += cost;
    }
  } else { used = units; }
  return { encoding: unicode ? 'Unicode' : 'GSM-7', type: unicode ? 1 : 0, units, segments,
    singleLimit: single, multipartLimit: multi, remaining: (units > single ? multi : single) - used, unicodeCharacters };
}
export function validateSmsMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1600 || /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(value)) throw new Error('Enter a message of up to 1,600 characters without control characters.');
  return value.trim();
}
export interface SmsRosterMember { id: string; name: string; phone?: string | null; fellowship: string; is_active?: boolean; merged_into_id?: string | null }
export interface BulkSmsRecipient { memberId: string; name: string; phone: string; fellowship: string }
export const SMS_PREVIEW_TTL_MS = 15 * 60 * 1000;
export function smsPreviewExpired(createdAt: string, now = Date.now()): boolean {
  const created = Date.parse(createdAt);
  return !Number.isFinite(created) || now >= created + SMS_PREVIEW_TTL_MS;
}
export function smsDraftIssue(campaign: { created_at: string; sender: string; recipients: BulkSmsRecipient[] }, current: BulkSmsRecipient[], sender: string, now = Date.now()) {
  if (smsPreviewExpired(campaign.created_at, now)) return { code: 'PREVIEW_EXPIRED', error: 'This preview expired after 15 minutes. Nothing was sent. Refresh the preview, review it, then click Send.' };
  if (sender !== campaign.sender) return { code: 'SMS_SETTINGS_CHANGED', error: 'The SMS sender changed. Nothing was sent. Refresh the preview and review the new sender before sending.' };
  const signature = (recipients: BulkSmsRecipient[]) => JSON.stringify(recipients.map(recipient => [recipient.memberId, recipient.phone]).sort(([a], [b]) => a.localeCompare(b)));
  if (signature(current) !== signature(campaign.recipients)) return { code: 'AUDIENCE_CHANGED', error: 'The recipient list changed. Nothing was sent. Refresh the preview and review the updated recipients before sending.' };
  return null;
}
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
