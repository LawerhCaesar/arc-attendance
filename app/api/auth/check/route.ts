import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const context = await getAuthContext();
  
  if (context) {
    return NextResponse.json({ authenticated: true, ...context }, { status: 200 });
  }
  
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
