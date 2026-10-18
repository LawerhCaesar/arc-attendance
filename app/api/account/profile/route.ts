import { NextRequest, NextResponse } from 'next/server';
import { createSession, getAuthContext } from '@/lib/auth';
import { authenticateStaffLogin } from '@/lib/staff-login';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ownAccountProfile, saveOwnAccountEmail } from '@/lib/account-profile';
import { homeForPermissions } from '@/lib/permissions';

function failure(error: unknown) {
  if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'This email is already assigned to another account.' }, { status: 409 });
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: 'Your account settings could not be saved. Please try again.' }, { status: 503 });
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Sign in to view your account.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Account settings are unavailable.' }, { status: 503 });
  try {
    const profile = await ownAccountProfile(admin, context);
    return NextResponse.json({ ...profile, username: context.username, role: context.role, fellowship: context.fellowship,
      dashboardUrl: homeForPermissions(context), birthdayEmailReady: Boolean(process.env.RESEND_API_KEY && process.env.BIRTHDAY_REMINDER_FROM) },
    { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Sign in to update your account.' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-site changes are not allowed.' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body || typeof body.password !== 'string' || body.password.length > 256) return NextResponse.json({ error: 'Enter your current password to save your email.' }, { status: 400 });
    const verified = await authenticateStaffLogin(context.username, body.password);
    if (!verified || verified.username !== context.username || verified.accountId !== context.accountId) {
      return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 403 });
    }
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Account settings are unavailable.' }, { status: 503 });
    const saved = await saveOwnAccountEmail(admin, context, body.email);
    // Keep this device signed in; other managed sessions are revoked by SQL.
    if (context.accountId) await createSession({ ...verified, sessionVersion: saved.sessionVersion });
    return NextResponse.json({ email: saved.email, message: 'Your email was saved. You can now use it to sign in.' });
  } catch (error) { return failure(error); }
}
