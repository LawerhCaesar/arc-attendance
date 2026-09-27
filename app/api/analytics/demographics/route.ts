import { NextResponse } from 'next/server';
import { getMembers } from '@/lib/database';
import { isAuthenticated } from '@/lib/auth';
import { buildMemberDemographics } from '@/lib/member-demographics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authenticated = await isAuthenticated(['admin', 'pastor']);
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(buildMemberDemographics(await getMembers()), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error('Error fetching demographics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demographics data' },
      { status: 500 }
    );
  }
}
