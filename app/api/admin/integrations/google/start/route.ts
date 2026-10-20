import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getAuthContext } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { driveSettings } from '@/lib/integration-settings';
import { appOrigin } from '@/lib/app-origin';
export async function GET(request: NextRequest) {
  const context = await getAuthContext();
  if (!isSuperAdmin(context)) return NextResponse.json({ error: 'Base administrator access required.' }, { status: context ? 403 : 401 });
  const config = await driveSettings();
  if (!config.clientId || !config.clientSecret) return NextResponse.json({ error: 'Save Google OAuth settings first.' }, { status: 400 });
  const state = randomBytes(32).toString('hex');
  const redirectUri = new URL('/api/admin/integrations/google/callback', appOrigin(request.nextUrl.origin)).toString();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', state, access_type: 'offline', prompt: 'consent' }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set('arc_drive_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/api/admin/integrations/google' });
  return response;
}
