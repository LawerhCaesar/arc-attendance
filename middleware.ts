import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'admin_session';
const APP_ROLES = ['admin', 'pastor', 'attendance', 'fellowship_leader', 'welfare', 'first_timers'];

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(padded);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifySession(session: string | undefined): Promise<string | null> {
  if (!session) return null;

  const secret = process.env.ADMIN_SESSION_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'development-only-session-secret-change-me' : '');
  if (!secret) return null;

  const [encodedPayload, suppliedSignature] = session.split('.');
  if (!encodedPayload || !suppliedSignature) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
    if (toBase64Url(new Uint8Array(signature)) !== suppliedSignature) return null;

    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const valid = Boolean(
      payload.username &&
      typeof payload.role === 'string' && (APP_ROLES.includes(payload.role) || typeof payload.accountId === 'string') &&
      typeof payload.expiresAt === 'number' &&
      payload.expiresAt > Date.now()
    );
    return valid ? payload.role : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // API handlers enforce their own role checks. Their live roster/attendance
  // responses must never be replayed from a browser or shared cache after edits.
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  }
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const role = await verifySession(session);
  const authenticated = Boolean(role);

  if (
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    pathname.startsWith('/welfare') ||
    pathname.startsWith('/first-timers')
  ) {
    if (!authenticated) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Role permissions are resolved from the database by the page/API, not from
  // a possibly stale cookie. Leave login accessible for revoked sessions.

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/welfare/:path*', '/first-timers/:path*'],
};
