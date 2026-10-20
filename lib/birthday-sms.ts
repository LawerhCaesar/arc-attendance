import { createHash } from 'node:crypto';
import { nextBirthday } from './birthdays';
import { FELLOWSHIPS } from './fellowships';
import { normalizeDuplicatePhone } from './member-duplicates';
import { smsSettings, type SmsSettings } from './integration-settings';

export interface SmsAccount { phone: string | null; fellowship: string | null; role_id: string; is_active: boolean; birthday_sms_enabled: boolean }
export const BIRTHDAY_GREETING_SENDER = 'CEYC ARC';
export interface BirthdaySmsMember { id: string; name: string; birthday: string; fellowship: string; phone?: string | null }
export function birthdayGreetingJobs(members: BirthdaySmsMember[], today: string) {
  const recipients = new Set<string>();
  return members.flatMap(member => {
    const birthday = nextBirthday(member.birthday || '', today);
    const phone = normalizeDuplicatePhone(member.phone);
    if (!birthday || birthday.daysUntil !== 0 || !phone || recipients.has(phone)) return [];
    recipients.add(phone);
    const recipient = `+${phone}`;
    return [{ member, recipient, scheduledFor: birthday.nextDate, notificationType: 'birthday_sms_greeting',
      // A shared/legacy duplicate phone receives only one greeting per birthday date.
      key: createHash('sha256').update(JSON.stringify(['sms-greeting', recipient, birthday.nextDate])).digest('hex'),
      sender: BIRTHDAY_GREETING_SENDER,
      text: `Happy birthday, ${member.name.trim() || 'dear brethren'}! CEYC ARC celebrates you. May God bless you with joy, good health and a fruitful year ahead. We love you!` }];
  });
}
export function birthdaySmsContacts(accounts: SmsAccount[], leaderRoleId: string | null, adminRoleId: string | null) {
  return accounts.flatMap(account => {
    if (!account.is_active || account.birthday_sms_enabled === false) return [];
    const all = Boolean(adminRoleId && account.role_id === adminRoleId);
    if (!all && (!leaderRoleId || account.role_id !== leaderRoleId || !account.fellowship || !FELLOWSHIPS.includes(account.fellowship))) return [];
    const phone = normalizeDuplicatePhone(account.phone);
    return phone ? [{ phone: `+${phone}`, fellowship: all ? null : account.fellowship }] : [];
  });
}
export function birthdaySmsJobs(members: BirthdaySmsMember[], contacts: ReturnType<typeof birthdaySmsContacts>, today: string) {
  return members.flatMap(member => {
    const birthday = nextBirthday(member.birthday || '', today);
    if (!birthday || ![7,1].includes(birthday.daysUntil)) return [];
    const recipients = new Set(contacts.filter(contact => contact.fellowship === null || contact.fellowship === member.fellowship).map(contact => contact.phone));
    return [...recipients].map(recipient => ({ member, recipient, scheduledFor: birthday.nextDate, notificationType: `birthday_sms_${birthday.daysUntil}_day`,
      key: createHash('sha256').update(JSON.stringify(['sms', member.id, recipient, birthday.nextDate, birthday.daysUntil])).digest('hex'),
      sender: undefined,
      text: `ARC birthday reminder: ${member.name} (${member.fellowship}) celebrates ${birthday.daysUntil === 1 ? 'tomorrow' : 'in 7 days'}, ${birthday.display}.` }));
  });
}
export class SmsRejectedError extends Error {}
export async function sendBirthdaySms(recipient: string, text: string, settings?: SmsSettings): Promise<string> {
  const config = settings || await smsSettings();
  if (!config.apiKey || !config.sender) throw new SmsRejectedError('SMS setup is incomplete.');
  const response = await fetch('https://api.smsonlinegh.com/v5/message/sms/send', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `key ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ text, type: 0, sender: config.sender, destinations: [recipient.slice(1)] }) });
  if (response.status >= 400 && response.status < 500) throw new SmsRejectedError(`SMS provider rejected request (${response.status}).`);
  if (!response.ok) throw new Error('SMS provider response was uncertain.');
  const result = await response.json();
  if (typeof result.handshake?.id === 'number' && result.handshake.id !== 0) throw new SmsRejectedError('SMS provider rejected authentication or message settings.');
  if (result.handshake?.id !== 0 || result.handshake?.label !== 'HSHK_OK') throw new Error('SMS acceptance could not be confirmed.');
  const destination = result.data?.destinations?.find((item: { to?: string }) => normalizeDuplicatePhone(item.to) === normalizeDuplicatePhone(recipient));
  if (!destination?.id) throw new Error('SMS acceptance could not be confirmed.');
  const label = String(destination.status?.label || '');
  if (/FAILED|REJECTED|INVALID|EXPIRED|UNDELIVER|BLOCKED|INSUFFICIENT|CANCELLED|DELETED/.test(label)) throw new SmsRejectedError('SMS provider rejected this destination.');
  if (![2104,2105,2107,2108,2109,2110].includes(destination.status?.id) || !/^(DS_PENDING(?:_|$)|DS_DELIVERED$|DS_SUBMIT(?:TED$|_)|DS_ACCEPTED$)/.test(label)) throw new Error('SMS acceptance could not be confirmed.');
  return String(destination.id);
}
