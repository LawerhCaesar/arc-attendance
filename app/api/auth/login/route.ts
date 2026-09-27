import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifyPassword, type AuthContext } from '@/lib/auth';
import { configuredUsers } from '@/lib/configured-users';
import { DEFAULT_PERMISSIONS, homeForPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const normalized = username.trim().toLowerCase();
    const configured = configuredUsers().find(user => user.username.toLowerCase() === normalized);
    let context: AuthContext | null = null;
    if (configured) {
      if (await verifyPassword(password, configured.password)) {
        context = { username: configured.username, role: configured.role, fellowship: configured.fellowship, permissions: DEFAULT_PERMISSIONS[configured.role] };
      }
    } else {
      const admin = getSupabaseAdmin();
      if (!admin) return NextResponse.json({ error: 'Account service unavailable. Contact your administrator.' }, { status: 503 });
      const { data: account, error } = await admin.from('staff_accounts')
        .select('id, username, password_hash, role_id, fellowship, is_active, session_version').eq('username', normalized).maybeSingle();
      if (error) throw error;
      if (account?.is_active && await verifyPassword(password, account.password_hash)) {
        const { data: role, error: roleError } = await admin.from('staff_roles').select('key, permissions').eq('id', account.role_id).single();
        if (roleError) throw roleError;
        context = { username: account.username, role: role.key, permissions: role.permissions, fellowship: account.fellowship || undefined, accountId: account.id, sessionVersion: account.session_version };
      }
    }
    if (!context) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    await createSession(context);
    return NextResponse.json({ message: 'Login successful', role: context.role, permissions: context.permissions, redirectTo: homeForPermissions(context) });
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.message : 'Account lookup failed');
    return NextResponse.json({ error: 'Sign-in service unavailable. Please try again or contact your administrator.' }, { status: 503 });
  }
}
