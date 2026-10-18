import { createHash } from 'node:crypto';
import { validateAccountEmail } from './account-email';
import { nextBirthday } from './birthdays';
import { FELLOWSHIPS } from './fellowships';

export interface ReminderAccount {
  email: string | null; fellowship: string | null; role_id: string;
  is_active: boolean; configured_username: string | null;
}
interface ConfiguredContact { username: string; email?: string; role: string; fellowship?: string }
export interface LeaderContact { email: string; fellowship: string | null }
interface BirthdayMember { id: string; name: string; fellowship: string; birthday: string }

export function birthdayLeaderContacts(accounts: ReminderAccount[], leaderRoleId: string | null, configured: ConfiguredContact[], adminRoleId: string | null = null): LeaderContact[] {
  const overridden = new Set(accounts.map(account => account.configured_username));
  const contacts: LeaderContact[] = [];
  const add = (address: string | null | undefined, fellowship: string | null | undefined, allFellowships = false) => {
    if (!allFellowships && (!fellowship || !FELLOWSHIPS.includes(fellowship))) return;
    try {
      const email = validateAccountEmail(address);
      if (email) contacts.push({ email, fellowship: allFellowships ? null : fellowship! });
    } catch { /* Invalid legacy configuration must never select a different recipient. */ }
  };
  for (const account of accounts) {
    if (leaderRoleId && account.is_active && account.role_id === leaderRoleId) add(account.email, account.fellowship);
    if (adminRoleId && account.is_active && account.role_id === adminRoleId) add(account.email, null, true);
  }
  for (const account of configured) {
    if (account.role === 'fellowship_leader' && !overridden.has(account.username.toLowerCase())) add(account.email, account.fellowship);
    if (account.role === 'admin' && !overridden.has(account.username.toLowerCase())) add(account.email, null, true);
  }
  return contacts;
}

export function birthdayReminderJobs(members: BirthdayMember[], contacts: LeaderContact[], today: string, centralRecipient?: string) {
  const central = validateAccountEmail(centralRecipient);
  return members.flatMap(member => {
    const occurrence = nextBirthday(member.birthday || '', today);
    if (!occurrence || ![7, 1].includes(occurrence.daysUntil)) return [];
    const recipients = new Set(contacts.filter(contact => contact.fellowship === null || contact.fellowship === member.fellowship).map(contact => contact.email));
    if (central) recipients.add(central);
    return [...recipients].map(recipient => {
      const notificationType = `birthday_${occurrence.daysUntil}_day`;
      // A recipient is part of the identity: multiple leaders each receive mail.
      const key = createHash('sha256').update(JSON.stringify([notificationType, member.id, recipient, occurrence.nextDate])).digest('hex');
      return { member, recipient, occurrence, notificationType, idempotencyKey: `birthday-${key}` };
    });
  });
}
