import { NextRequest, NextResponse } from 'next/server';
import { dateInAccra } from '@/lib/birthdays';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { configuredUsers } from '@/lib/configured-users';
import { birthdayLeaderContacts, birthdayReminderJobs, type ReminderAccount } from '@/lib/birthday-reminders';
import { fetchAllRows } from '@/lib/pagination';

const defaultRecipient = 'lakumbie@gmail.com';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.BIRTHDAY_REMINDER_FROM;
  const centralRecipient = process.env.BIRTHDAY_REMINDER_TO || defaultRecipient;
  if (!admin || !resendKey || !from) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and BIRTHDAY_REMINDER_FROM are required' },
      { status: 503 }
    );
  }

  try {
    const [members, accounts, leaderRole] = await Promise.all([
      fetchAllRows<{ id: string; name: string; fellowship: string; birthday: string }>((from, to) => admin
        .from('members').select('id, name, fellowship, birthday').eq('is_active', true).order('id').range(from, to)),
      fetchAllRows<ReminderAccount>((from, to) => admin.from('staff_accounts')
        .select('email, fellowship, role_id, is_active, configured_username').order('id').range(from, to)),
      admin.from('staff_roles').select('id').eq('key', 'fellowship_leader').single(),
    ]);
    if (leaderRole.error) throw leaderRole.error;
    const contacts = birthdayLeaderContacts(accounts, leaderRole.data.id, configuredUsers());
    const jobs = birthdayReminderJobs(members, contacts, dateInAccra(), centralRecipient);
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const { member, recipient, occurrence, notificationType, idempotencyKey } of jobs) {
      const personKey = member.id;
      const { data: existing, error: deliveryCheckError } = await admin
        .from('notification_deliveries')
        .select('id')
        .eq('notification_type', notificationType)
        .eq('person_key', personKey)
        .eq('recipient', recipient)
        .eq('scheduled_for', occurrence.nextDate)
        .eq('status', 'sent')
        .maybeSingle();

      if (deliveryCheckError) {
        errors.push('Could not check reminder delivery history');
        continue;
      }
      if (existing) {
        skipped += 1;
        continue;
      }

      const timing = occurrence.daysUntil === 1 ? 'tomorrow' : 'in 7 days';
      const subject = `Birthday reminder: ${member.name} (${timing})`;
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ARC-Attendance/1.0',
            'Idempotency-Key': idempotencyKey,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            from,
            to: [recipient],
            subject,
            html: `<h2>Upcoming birthday</h2><p><strong>${escapeHtml(member.name)}</strong> celebrates a birthday ${timing}, on ${escapeHtml(occurrence.display)}.</p><p>Fellowship: ${escapeHtml(member.fellowship || 'Unassigned')}</p>`,
            text: `${member.name} celebrates a birthday ${timing}, on ${occurrence.display}. Fellowship: ${member.fellowship || 'Unassigned'}.`,
          }),
        });

        if (!response.ok) {
          errors.push(`Email provider returned ${response.status}`);
          continue;
        }
        const result = await response.json() as { id?: string };
        const { error: deliveryError } = await admin.from('notification_deliveries').upsert({
          notification_type: notificationType,
          person_key: personKey,
          recipient,
          scheduled_for: occurrence.nextDate,
          provider_message_id: result.id || null,
          status: 'sent',
        }, { onConflict: 'notification_type,person_key,recipient,scheduled_for' });
        if (deliveryError) {
          errors.push('Email sent but delivery history could not be saved');
        }
        sent += 1;
      } catch {
        errors.push('Email delivery could not be completed. Retry this run.');
      }
    }

    return NextResponse.json({ success: errors.length === 0, sent, skipped, errors }, { status: errors.length ? 502 : 200 });
  } catch {
    return NextResponse.json({ error: 'Could not load birthday reminders and leader recipients.' }, { status: 503 });
  }
}
