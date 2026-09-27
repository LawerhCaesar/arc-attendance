import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth';
import { getAttendanceData, getMembers } from '@/lib/database';
import { buildPastoralDashboard } from '@/lib/pastoral-dashboard';
import { dashboardRange } from '@/lib/dashboard-period';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await hasPermission('overview'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const query = request.nextUrl.searchParams;
    let range;
    try {
      range = dashboardRange(query.get('period') || 'ytd', query.get('start'), query.get('end'), now);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    const [attendance, members] = await Promise.all([
      getAttendanceData(),
      getMembers(),
    ]);

    return NextResponse.json(buildPastoralDashboard(attendance, members, now, range), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error building pastoral dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to build pastoral dashboard' },
      { status: 500 }
    );
  }
}
