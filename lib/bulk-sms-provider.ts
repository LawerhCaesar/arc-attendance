import { normalizeDuplicatePhone } from './member-duplicates';
import { smsMessageInfo, type SmsOutcome } from './bulk-sms';
import type { SmsSettings } from './integration-settings';

export async function submitBulkSms(phones: string[], message: string, config: SmsSettings): Promise<SmsOutcome[]> {
  const outcomes = (status: SmsOutcome['status']) => phones.map(phone => ({ phone, status }));
  try {
    const response = await fetch('https://api.smsonlinegh.com/v5/message/sms/send', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `key ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text: message, type: smsMessageInfo(message).type, sender: config.sender, destinations: phones.map(phone => phone.slice(1)) }),
    });
    if (response.status >= 400 && response.status < 500) return outcomes('rejected');
    if (!response.ok) return outcomes('uncertain');
    const result = await response.json();
    if (typeof result.handshake?.id === 'number' && result.handshake.id !== 0) return outcomes('rejected');
    if (result.handshake?.id !== 0 || result.handshake?.label !== 'HSHK_OK' || !Array.isArray(result.data?.destinations)) return outcomes('uncertain');
    return phones.map(phone => {
      const matches = result.data.destinations.filter((item: { to?: string }) => typeof item.to === 'string' && normalizeDuplicatePhone(item.to) === phone.slice(1));
      if (matches.length !== 1) return { phone, status: 'uncertain' };
      const item = matches[0], label = String(item.status?.label || '');
      if (/^DS_(REJECTED|EXPIRED|UNDELIVERED|SCHEDULE_CANCELLED|SCHEDULE_DELETED|IGNORED)/.test(label)) return { phone, status: 'rejected' };
      if (typeof item.id !== 'string' || !item.id || item.id.length > 200 || ![2104,2105,2106,2107,2108,2109,2110,2139].includes(item.status?.id) || !/^DS_(PENDING(?:_|$)|DELIVERED$|SUBMIT(?:TED$|_))/.test(label)) return { phone, status: 'uncertain' };
      return { phone, status: 'accepted', messageId: item.id };
    });
  } catch { return outcomes('uncertain'); }
}

export interface SmsBalance { balance: number; model: 'quantity' | 'currency'; currency: string | null }
export async function fetchSmsBalance(config: SmsSettings): Promise<SmsBalance> {
  const response = await fetch('https://api.smsonlinegh.com/v5/account/balance', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `key ${config.apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  const data = result.data;
  if (!response.ok || result.handshake?.id !== 0 || result.handshake?.label !== 'HSHK_OK' || typeof data?.balance !== 'number' || !Number.isFinite(data.balance) || data.balance < 0 || !['quantity','currency'].includes(data.model)) throw new Error('SMS balance could not be checked. Open SMSOnlineGH to verify your credits.');
  return { balance: data.balance, model: data.model, currency: data.model === 'currency' && typeof data.currencyCode === 'string' ? data.currencyCode.slice(0, 8) : null };
}
