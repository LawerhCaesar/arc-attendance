import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'admin_session';

function verifySession(session: string | undefined): boolean {
  if (!session) return false;
  
  try {
    const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'default-secret-change-in-production';
    const decoded = Buffer.from(session, 'base64').toString();
    return decoded.includes(SESSION_SECRET);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Protect admin routes
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!verifySession(session)) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Redirect from login if already authenticated
  if (pathname === '/admin/login') {
    if (verifySession(session)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

