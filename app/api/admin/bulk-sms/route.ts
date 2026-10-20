import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { smsSettings } from '@/lib/integration-settings';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { fetchAllRows } from '@/lib/pagination';
import { bulkSmsRecipients, campaignColumns, SMS_BATCH_SIZE, smsMessageInfo, validateSmsMessage, type BulkSmsCampaign, type BulkSmsRecipient, type SmsOutcome, type SmsRosterMember } from '@/lib/bulk-sms';
import { submitBulkSms } from '@/lib/bulk-sms-provider';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => NextResponse.json({ error: 'Bulk SMS is unavailable. Check the database configuration and bulk SMS migration.' }, { status: 503 });
type StoredCampaign = BulkSmsCampaign & { recipients: BulkSmsRecipient[]; results: SmsOutcome[] };
async function roster(fellowship: string | null) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Database unavailable');
  return fetchAllRows<SmsRosterMember>((from, to) => {
    let query = admin.from('members').select('id,name,phone,fellowship').eq('is_active', true).is('merged_into_id', null).order('id').range(from, to);
    if (fellowship !== null) query = query.eq('fellowship', fellowship);
    return query;
  });
}
function publicCampaign(campaign: StoredCampaign) {
  // Recipient snapshots and provider identifiers stay in the protected history.
  const { recipients, results: _results, ...summary } = campaign;
  return { ...summary, recipients: campaign.status === 'draft' ? recipients : undefined };
}

export async function GET() {
  const context = await getAuthContext();
  if (context?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: context ? 403 : 401 });
  try {
    const admin = getSupabaseAdmin(); if (!admin) return unavailable();
    const [settings, history, members] = await Promise.all([
      smsSettings(),
      admin.from('bulk_sms_campaigns').select(campaignColumns).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(30),
      roster(null),
    ]);
    if (history.error) return unavailable();
    return NextResponse.json({ configured: Boolean(settings.apiKey && settings.sender), sender: settings.sender, history: history.data,
      audiences: [null, ...FELLOWSHIPS].map(fellowship => {
        const { recipients, missingPhone, duplicatePhone } = bulkSmsRecipients(members, fellowship);
        return { fellowship, recipients: recipients.length, missingPhone, duplicatePhone };
      }) }, { headers });
  } catch { return unavailable(); }
}

export async function POST(request: NextRequest) {
  const context = await getAuthContext();
  if (context?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: context ? 403 : 401 });
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-site changes are not allowed.' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid SMS request.' }, { status: 400 }); }
  if (!body || !uuid.test(body.id || '')) return NextResponse.json({ error: 'A valid message reference is required.' }, { status: 400 });
  try {
    const admin = getSupabaseAdmin(); if (!admin) return unavailable();
    if (body.action === 'preview') {
      let message: string;
      try { message = validateSmsMessage(body.message); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
      if (body.fellowship !== null && (typeof body.fellowship !== 'string' || !FELLOWSHIPS.includes(body.fellowship))) return NextResponse.json({ error: 'Choose a fellowship or the entire church.' }, { status: 400 });
      const fellowship = body.fellowship as string | null;
      const [members, settings] = await Promise.all([roster(fellowship), smsSettings()]);
      const { recipients, missingPhone, duplicatePhone } = bulkSmsRecipients(members, fellowship);
      if (!recipients.length) return NextResponse.json({ error: 'There are no active brethren with valid phone numbers in this audience.' }, { status: 400 });
      const info = smsMessageInfo(message);
      const saved = await admin.from('bulk_sms_campaigns').insert({ id: body.id, created_by: context.username, fellowship, message,
        sender: settings.sender || 'CEYC ARC', recipients, recipient_count: recipients.length, segments: info.segments, encoding: info.encoding,
        missing_phone: missingPhone, duplicate_phone: duplicatePhone }).select('*').single();
      if (saved.error?.code === '23505') {
        const existing = await admin.from('bulk_sms_campaigns').select('*').eq('id', body.id).single();
        if (!existing.error && existing.data.message === message && existing.data.fellowship === fellowship && existing.data.status === 'draft') return NextResponse.json(publicCampaign(existing.data), { headers });
        return NextResponse.json({ error: 'This message reference has already been used. Preview the message again.' }, { status: 409 });
      }
      if (saved.error) return unavailable();
      return NextResponse.json(publicCampaign(saved.data), { headers });
    }
    if (body.action !== 'send') return NextResponse.json({ error: 'Choose preview or send.' }, { status: 400 });
    const existing = await admin.from('bulk_sms_campaigns').select('*').eq('id', body.id).maybeSingle();
    if (existing.error) return unavailable();
    const campaign = existing.data as StoredCampaign | null;
    if (!campaign) return NextResponse.json({ error: 'Message preview was not found.' }, { status: 404 });
    if (!['draft','ready'].includes(campaign.status)) return NextResponse.json(publicCampaign(campaign), { headers });
    const [settings, members] = await Promise.all([smsSettings(), roster(campaign.fellowship)]);
    if (!settings.apiKey || !settings.sender) return NextResponse.json({ error: 'The base administrator must complete SMSOnlineGH setup in Users & Roles before sending.' }, { status: 503 });
    const current = bulkSmsRecipients(members, campaign.fellowship).recipients;
    if (campaign.status === 'draft') {
      const signature = (recipients: BulkSmsRecipient[]) => JSON.stringify(recipients.map(recipient => [recipient.memberId, recipient.phone]));
      if (Date.now() - Date.parse(campaign.created_at) > 15 * 60 * 1000 || settings.sender !== campaign.sender || signature(current) !== signature(campaign.recipients)) return NextResponse.json({ error: 'The audience or SMS setup changed, or this preview expired. Preview again before sending.' }, { status: 409 });
    }
    // One durable claim per batch. Overlapping requests cannot submit the same
    // destinations twice; interrupted/uncertain submissions require review.
    const claim = await admin.from('bulk_sms_campaigns').update({ status: 'sending', sent_by: context.username, updated_at: new Date().toISOString() })
      .eq('id', campaign.id).eq('status', campaign.status).eq('next_offset', campaign.next_offset).select('id').maybeSingle();
    if (claim.error) return unavailable();
    if (!claim.data) return NextResponse.json({ error: 'This message is already being processed. Refresh the message history.' }, { status: 409 });
    const batch = campaign.recipients.slice(campaign.next_offset, campaign.next_offset + SMS_BATCH_SIZE);
    const eligible = new Set(current.map(recipient => `${recipient.memberId}:${recipient.phone}`));
    const included = batch.filter(recipient => eligible.has(`${recipient.memberId}:${recipient.phone}`));
    const outcomes: SmsOutcome[] = batch.filter(recipient => !eligible.has(`${recipient.memberId}:${recipient.phone}`)).map(recipient => ({ phone: recipient.phone, status: 'skipped' }));
    if (included.length) outcomes.push(...await submitBulkSms(included.map(recipient => recipient.phone), campaign.message, { ...settings, sender: campaign.sender }));
    const next = campaign.next_offset + batch.length;
    const counts = { accepted: campaign.accepted, rejected: campaign.rejected, uncertain: campaign.uncertain, skipped: campaign.skipped };
    for (const outcome of outcomes) counts[outcome.status]++;
    const status = counts.uncertain ? 'uncertain' : next === campaign.recipient_count ? 'completed' : 'ready';
    const saved = await admin.from('bulk_sms_campaigns').update({ ...counts, status, next_offset: next, results: [...campaign.results, ...outcomes], updated_at: new Date().toISOString() })
      .eq('id', campaign.id).eq('status', 'sending').eq('next_offset', campaign.next_offset).select('*').single();
    if (saved.error) return NextResponse.json({ error: 'The provider was contacted, but confirmation could not be saved. Review SMSOnlineGH and message history before sending again.' }, { status: 503 });
    return NextResponse.json(publicCampaign(saved.data), { headers });
  } catch { return unavailable(); }
}
