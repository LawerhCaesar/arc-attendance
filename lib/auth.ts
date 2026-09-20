import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const APP_ROLES = [
  'admin',
  'pastor',
  'attendance',
  'fellowship_leader',
  'welfare',
  'first_timers',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export interface AuthContext {
  username: string;
  role: AppRole;
  fellowship?: string;
}

export function homeForRole(role: AppRole): string {
  if (role === 'welfare') return '/welfare';
  if (role === 'first_timers') return '/first-timers';
  if (role === 'attendance' || role === 'fellowship_leader') return '/entry';
  return '/admin';
}

interface SessionPayload extends AuthContext {
  issuedAt: number;
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'development-only-session-secret-change-me';
  throw new Error('ADMIN_SESSION_SECRET must be configured in production');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
}

function encodeSession(payload: SessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [encodedPayload, suppliedSignature] = token.split('.');
  if (!encodedPayload || !suppliedSignature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as SessionPayload;
    if (!payload.username || !APP_ROLES.includes(payload.role) || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, storedPassword: string): Promise<boolean> {
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compare(password, storedPassword);
  }
  return password === storedPassword;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function createSession(context: AuthContext): Promise<string> {
  const now = Date.now();
  const token = encodeSession({
    ...context,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  const payload = decodeSession(session);
  if (!payload) return null;
  return {
    username: payload.username,
    role: payload.role,
    fellowship: payload.fellowship,
  };
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function isAuthenticated(allowedRoles?: readonly AppRole[]): Promise<boolean> {
  const context = await getAuthContext();
  if (!context) return false;
  return !allowedRoles || allowedRoles.includes(context.role);
}
