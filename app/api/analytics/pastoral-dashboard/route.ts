import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth';
import { getAttendanceData, getMembers } from '@/lib/database';
import { buildPastoralDashboard } from '@/lib/pastoral-dashboard';
import { dashboardRange } from '@/lib/dashboard-period';
import { loadRosterAttendanceSummary } from '@/lib/roster-attendance-source';

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
    const [attendance, members, attendanceSummary] = await Promise.all([
      getAttendanceData(),
      getMembers(),
      loadRosterAttendanceSummary(undefined,false),
    ]);

    const dashboard = buildPastoralDashboard(attendance, members, now, range);
    const attendanceCounts = {green:0,yellow:0,red:0};
    for (const status of Object.values(attendanceSummary.members)) {
      if (status.color==='green'||status.color==='yellow'||status.color==='red') attendanceCounts[status.color]++;
    }
    // Overview needs totals and the colors of people it already displays, not
    // additional roster identities for roles without roster access.
    const visibleIds = new Set([...dashboard.care.absentMembers,...dashboard.care.upcomingBirthdays].map(person=>person.id));
    attendanceSummary.members = Object.fromEntries(Object.entries(attendanceSummary.members).filter(([id])=>visibleIds.has(id)));
    return NextResponse.json({...dashboard,attendanceSummary,attendanceCounts}, {
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
