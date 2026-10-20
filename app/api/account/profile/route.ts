import { NextRequest, NextResponse } from 'next/server';
import { createSession, getAuthContext } from '@/lib/auth';
import { authenticateStaffLogin } from '@/lib/staff-login';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ownAccountProfile, saveOwnAccountProfile, ProfileConflictError } from '@/lib/account-profile';
import { homeForPermissions } from '@/lib/permissions';
import { smsSettings } from '@/lib/integration-settings';

function failure(error: unknown) {
  if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'This username or email is already assigned to another account.' }, { status: 409 });
  if (error instanceof ProfileConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
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
    const sms = await smsSettings();
    return NextResponse.json({ ...profile, username: context.username, role: context.role, fellowship: context.fellowship,
      dashboardUrl: homeForPermissions(context), birthdaySmsReady: Boolean(sms.apiKey && sms.sender) },
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
    if (!body || typeof body.password !== 'string' || body.password.length > 256) return NextResponse.json({ error: 'Enter your current password to save profile changes.' }, { status: 400 });
    const verified = await authenticateStaffLogin(context.username, body.password);
    if (!verified || verified.username !== context.username || verified.accountId !== context.accountId) {
      return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 403 });
    }
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Account settings are unavailable.' }, { status: 503 });
    const saved = await saveOwnAccountProfile(admin, verified, { email: body.email, username: body.username,
      phone: body.phone, birthdaySmsEnabled: body.birthdaySmsEnabled, newPassword: body.newPassword, confirmNewPassword: body.confirmNewPassword });
    await createSession(saved.context);
    const profile = await ownAccountProfile(admin, saved.context);
    return NextResponse.json({ username: saved.username, email: saved.email, phone: profile.phone, birthdaySmsEnabled: profile.birthdaySmsEnabled, message: 'Your profile was updated. Use your saved username or email and password to sign in.' });
  } catch (error) { return failure(error); }
}
