import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getAttendanceData, getMembers } from '@/lib/database';
import { buildPastoralDashboard } from '@/lib/pastoral-dashboard';
import { dateInAccra } from '@/lib/birthdays';

export const dynamic = 'force-dynamic';

// Public check-in receives aggregate counts only, never attendance identities.
// Signed-in fellowship leaders retain their configured scope.
export async function GET() {
  try {
    const context = await getAuthContext();
    if (context?.role === 'fellowship_leader' && !context.fellowship) {
      return NextResponse.json({ error: 'No fellowship scope configured' }, { status: 403 });
    }
    const today = new Date(`${dateInAccra()}T00:00:00Z`);
    today.setUTCDate(today.getUTCDate() - today.getUTCDay());
    const serviceDate = today.toISOString().slice(0, 10);
    const [attendance, members] = await Promise.all([getAttendanceData(), getMembers()]);
    const scope = context?.role === 'fellowship_leader' ? context.fellowship : null;
    const result = buildPastoralDashboard(
      scope ? attendance.filter(record => record.fellowship === scope) : attendance,
      scope ? members.filter(member => member.fellowship === scope) : members,
      new Date(), { start: serviceDate, end: serviceDate },
    );
    return NextResponse.json({
      serviceDate,
      activeMembers: result.latestService.activeMembers,
      savedPresent: result.period!.uniquePeople,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Error fetching check-in totals:', error);
    return NextResponse.json({ error: 'Saved attendance totals are unavailable. Please refresh.' }, { status: 500 });
  }
}
