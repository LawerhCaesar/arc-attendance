import { NextRequest, NextResponse } from 'next/server';
import { dateInAccra, nextBirthday } from '@/lib/birthdays';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
  const recipient = process.env.BIRTHDAY_REMINDER_TO || defaultRecipient;
  if (!admin || !resendKey || !from) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and BIRTHDAY_REMINDER_FROM are required' },
      { status: 503 }
    );
  }

  const { data: members, error: membersError } = await admin
    .from('members')
    .select('id, name, phone, fellowship, birthday')
    .eq('is_active', true);
  if (membersError) {
    return NextResponse.json({ error: 'Failed to load member birthdays' }, { status: 500 });
  }

  const today = dateInAccra();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const member of members || []) {
    const occurrence = nextBirthday(member.birthday || '', today);
    if (!occurrence || ![7, 1].includes(occurrence.daysUntil)) continue;

    const notificationType = `birthday_${occurrence.daysUntil}_day`;
    const personKey = String(member.id || `${member.name}-${member.birthday}`);
    const { data: existing, error: deliveryCheckError } = await admin
      .from('notification_deliveries')
      .select('id')
      .eq('notification_type', notificationType)
      .eq('person_key', personKey)
      .eq('recipient', recipient)
      .eq('scheduled_for', occurrence.nextDate)
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
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ARC-Attendance/1.0',
        'Idempotency-Key': `${notificationType}-${encodeURIComponent(personKey)}-${occurrence.nextDate}`.slice(0, 256),
      },
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
    const { error: deliveryError } = await admin.from('notification_deliveries').insert({
      notification_type: notificationType,
      person_key: personKey,
      recipient,
      scheduled_for: occurrence.nextDate,
      provider_message_id: result.id || null,
      status: 'sent',
    });
    if (deliveryError) {
      errors.push('Email sent but delivery history could not be saved');
    }
    sent += 1;
  }

  return NextResponse.json({ success: errors.length === 0, sent, skipped, errors });
}
