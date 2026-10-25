import { NextRequest, NextResponse } from 'next/server';
import { dateInAccra } from '@/lib/birthdays';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { birthdayGreetingJobs, birthdaySmsContacts, birthdaySmsJobs, sendBirthdaySms, SmsRejectedError, type BirthdaySmsMember, type SmsAccount } from '@/lib/birthday-sms';
import { smsSettings } from '@/lib/integration-settings';
import { fetchAllRows } from '@/lib/pagination';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    const sms = await smsSettings();
    if (!admin || !sms.apiKey || !sms.sender) return NextResponse.json({ error: 'Complete SMSOnlineGH setup in Users & Roles. Birthday email sending has been replaced by SMS.' }, { status: 503 });
    const [members, accounts, roles] = await Promise.all([
      fetchAllRows<BirthdaySmsMember>((from,to) => admin.from('members').select('id,name,fellowship,birthday,phone').eq('is_active',true).is('merged_into_id',null).order('id').range(from,to)),
      fetchAllRows<SmsAccount>((from,to) => admin.from('staff_accounts').select('phone,fellowship,role_id,is_active,birthday_sms_enabled').order('id').range(from,to)),
      admin.from('staff_roles').select('id,key').in('key',['fellowship_leader','admin']),
    ]);
    if (roles.error) throw roles.error;
    const contacts = birthdaySmsContacts(accounts, roles.data.find(role => role.key === 'fellowship_leader')?.id || null, roles.data.find(role => role.key === 'admin')?.id || null);
    const today = dateInAccra();
    const jobs = [...birthdayGreetingJobs(members,today), ...birthdaySmsJobs(members,contacts,today)];
    let accepted=0, skipped=0; const errors: string[]=[];
    for (const job of jobs) {
      // A persisted unique claim prevents overlapping runs and uncertain retries from sending twice.
      const claim = await admin.from('birthday_sms_deliveries').insert({ idempotency_key:job.key, member_id:job.member.id, recipient:job.recipient,
        scheduled_for:job.scheduledFor, notification_type:job.notificationType, status:'sending' });
      if (claim.error?.code === '23505') {
        const existing = await admin.from('birthday_sms_deliveries').select('status').eq('idempotency_key',job.key).single();
        if (existing.error) { errors.push('Could not check SMS history.'); continue; }
        if (existing.data.status !== 'failed') {
          skipped++; if (existing.data.status === 'uncertain' || existing.data.status === 'sending') errors.push('An SMS acceptance needs review before retrying.');
          continue;
        }
        const retry = await admin.from('birthday_sms_deliveries').update({status:'sending',error_code:null,updated_at:new Date().toISOString()}).eq('idempotency_key',job.key).eq('status','failed').select('idempotency_key').maybeSingle();
        if (retry.error) { errors.push('Could not claim SMS retry.'); continue; }
        if (!retry.data) { skipped++; continue; }
      } else if (claim.error) { errors.push('Could not record SMS claim.'); continue; }
      let messageId: string;
      try { messageId = await sendBirthdaySms(job.recipient,job.text,{...sms,sender:job.sender || sms.sender}); }
      catch (error) {
        const status = error instanceof SmsRejectedError ? 'failed' : 'uncertain';
        const saved = await admin.from('birthday_sms_deliveries').update({status,error_code:status === 'failed'?'provider_rejected':'acceptance_unknown',updated_at:new Date().toISOString()}).eq('idempotency_key',job.key);
        errors.push(saved.error ? 'SMS state could not be saved; review before retrying.' : status === 'failed' ? 'SMS was rejected by the provider.' : 'SMS acceptance is uncertain; review before retrying.');
        continue;
      }
      const saved = await admin.from('birthday_sms_deliveries').update({status:'accepted',provider_message_id:messageId,updated_at:new Date().toISOString()}).eq('idempotency_key',job.key);
      accepted++; if (saved.error) errors.push('SMS accepted but confirmation could not be saved; review before retrying.');
    }
    return NextResponse.json({success:!errors.length,channel:'sms',accepted,skipped,errors}, {status:errors.length?502:200});
  } catch { return NextResponse.json({error:'Could not load birthday SMS reminders and recipients.'},{status:503}); }
}
