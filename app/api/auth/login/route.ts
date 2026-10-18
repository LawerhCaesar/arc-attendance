import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { homeForPermissions } from '@/lib/permissions';
import { authenticateStaffLogin } from '@/lib/staff-login';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 254 || password.length > 256) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const context = await authenticateStaffLogin(username, password);
    if (!context) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    await createSession(context);
    return NextResponse.json({ message: 'Login successful', role: context.role, permissions: context.permissions, redirectTo: homeForPermissions(context) });
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.message : 'Account lookup failed');
    return NextResponse.json({ error: 'Sign-in service unavailable. Please try again or contact your administrator.' }, { status: 503 });
  }
}
