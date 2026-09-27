import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { homeForPermissions } from '@/lib/permissions';

export async function GET() {
  const context = await getAuthContext();
  
  if (context) {
    return NextResponse.json({ authenticated: true, ...context, redirectTo: homeForPermissions(context) }, { status: 200 });
  }
  
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
