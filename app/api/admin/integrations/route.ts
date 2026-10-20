import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { driveSettings, smsSettings, writeIntegration, IntegrationSettingsError } from '@/lib/integration-settings';
import { appOrigin } from '@/lib/app-origin';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const context = await getAuthContext();
  if (!isSuperAdmin(context)) return NextResponse.json({ error: 'Base administrator access required.' }, { status: context ? 403 : 401 });
  try {
    const [sms, drive] = await Promise.all([smsSettings(), driveSettings()]);
    return NextResponse.json({ smsConfigured: Boolean(sms.apiKey && sms.sender), smsSender: sms.sender || '',
      googleClientId: drive.clientId || '', googleClientSecretSaved: Boolean(drive.clientSecret),
      driveConnected: Boolean(drive.refreshToken && drive.folderId),
      googleRedirectUri: new URL('/api/admin/integrations/google/callback', appOrigin(request.nextUrl.origin)).toString() },
    { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof IntegrationSettingsError ? error.message : 'Integration settings could not be loaded. Please try again.' }, { status: 503 });
  }
}
export async function PATCH(request: NextRequest) {
  const context = await getAuthContext();
  if (!isSuperAdmin(context)) return NextResponse.json({ error: 'Base administrator access required.' }, { status: context ? 403 : 401 });
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-site changes are not allowed.' }, { status: 403 });
  try {
    const body = await request.json();
    if (body.provider === 'sms_online_gh') {
      const saved = await smsSettings();
      if (typeof body.apiKey !== 'string' || body.apiKey.length > 512 || typeof body.sender !== 'string' || !/^[A-Za-z0-9 ._-]{1,11}$/.test(body.sender.trim())) throw new Error('Enter your approved SMS sender name (up to 11 characters) and API key.');
      const apiKey = body.apiKey.trim() || saved.apiKey;
      if (!apiKey || /\s/.test(apiKey)) throw new Error('Enter a valid SMSOnlineGH API key.');
      await writeIntegration('sms_online_gh', { apiKey, sender: body.sender.trim() }, context!.username);
    } else if (body.provider === 'google_drive') {
      const saved = await driveSettings();
      if (typeof body.clientId !== 'string' || !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(body.clientId) || body.clientId.length > 250 || typeof body.clientSecret !== 'string' || body.clientSecret.length > 512) throw new Error('Enter a valid Google web OAuth client ID and client secret.');
      const secret = body.clientSecret.trim() || saved.clientSecret;
      if (!secret) throw new Error('Enter the Google OAuth client secret.');
      const changed = body.clientId !== saved.clientId || secret !== saved.clientSecret;
      await writeIntegration('google_drive', { ...(changed ? {} : saved), clientId: body.clientId, clientSecret: secret }, context!.username);
    } else throw new Error('Choose a supported integration.');
    return NextResponse.json({ message: 'Integration settings saved.' });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Settings could not be saved.' }, { status: 400 }); }
}
