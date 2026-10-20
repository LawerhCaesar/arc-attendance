import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { smsSettings } from '@/lib/integration-settings';
import { fetchSmsBalance } from '@/lib/bulk-sms-provider';
export const dynamic = 'force-dynamic';
export async function GET() {
  const context = await getAuthContext();
  if (context?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: context ? 403 : 401 });
  try {
    const settings = await smsSettings();
    if (!settings.apiKey) return NextResponse.json({ error: 'Complete SMSOnlineGH setup in Users & Roles first.' }, { status: 503 });
    return NextResponse.json(await fetchSmsBalance(settings), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'SMS balance could not be checked. Open SMSOnlineGH to verify your credits.' }, { status: 502 }); }
}
