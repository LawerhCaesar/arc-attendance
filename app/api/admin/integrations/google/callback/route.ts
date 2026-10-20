import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getAuthContext } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { driveSettings, writeIntegration } from '@/lib/integration-settings';
import { appOrigin } from '@/lib/app-origin';
export async function GET(request: NextRequest) {
  const context = await getAuthContext();
  if (!isSuperAdmin(context)) return NextResponse.json({ error: 'Base administrator access required.' }, { status: context ? 403 : 401 });
  const expected = request.cookies.get('arc_drive_oauth_state')?.value || '';
  const supplied = request.nextUrl.searchParams.get('state') || '';
  const redirect = new URL('/admin', appOrigin(request.nextUrl.origin));
  let notice = 'Google Drive connection was not completed. Try again from Users & Roles.';
  try {
    if (!expected || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new Error('Invalid state');
    const code = request.nextUrl.searchParams.get('code');
    if (!code || code.length > 4096 || request.nextUrl.searchParams.has('error')) throw new Error('No authorization code');
    const config = await driveSettings();
    if (!config.clientId || !config.clientSecret) throw new Error('No client');
    const result = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, grant_type: 'authorization_code', redirect_uri: new URL('/api/admin/integrations/google/callback', redirect.origin).toString() }) });
    const tokens = await result.json();
    if (!result.ok || !tokens.access_token || !tokens.refresh_token) throw new Error('Google authorization failed');
    let folderId = config.folderId;
    if (folderId) {
      const accessible = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed`, { cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const folder = await accessible.json();
      if (!accessible.ok || folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder') folderId = undefined;
    }
    if (!folderId) {
      const folder = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'ARC Attendance Photos', mimeType: 'application/vnd.google-apps.folder', appProperties: { arcAttendancePhotos: 'true' } }) });
      const saved = await folder.json();
      if (!folder.ok || !/^[A-Za-z0-9_-]{10,200}$/.test(saved.id || '')) throw new Error('Photo folder could not be created');
      folderId = saved.id;
    }
    await writeIntegration('google_drive', { ...config, refreshToken: tokens.refresh_token, folderId }, context!.username);
    notice = 'Google Drive connected. Profile picture uploads are ready.';
  } catch { /* Do not expose Google tokens, authorization codes or provider responses. */ }
  redirect.searchParams.set('integrationNotice', notice);
  const response = NextResponse.redirect(redirect);
  response.cookies.set('arc_drive_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/api/admin/integrations/google' });
  return response;
}
