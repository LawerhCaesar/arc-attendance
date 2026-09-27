import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getAttendanceData, getMembers } from '@/lib/database';
import { buildPastoralDashboard } from '@/lib/pastoral-dashboard';
import { dateInAccra } from '@/lib/birthdays';
import { presentRosterMemberIds } from '@/lib/attendance-identity';

export const dynamic = 'force-dynamic';

// Public check-in receives totals and active roster IDs for this service only.
// Do not expose visitor identities, contact details, or historical attendance.
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
    const scopedAttendance = scope ? attendance.filter(record => record.fellowship === scope) : attendance;
    const scopedMembers = scope ? members.filter(member => member.fellowship === scope) : members;
    const result = buildPastoralDashboard(
      scopedAttendance,
      scopedMembers,
      new Date(), { start: serviceDate, end: serviceDate },
    );
    return NextResponse.json({
      serviceDate,
      activeMembers: result.latestService.activeMembers,
      savedPresent: result.period!.uniquePeople,
      presentMemberIds: presentRosterMemberIds(scopedAttendance, scopedMembers, serviceDate),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Error fetching check-in totals:', error);
    return NextResponse.json({ error: 'Saved attendance totals are unavailable. Please refresh.' }, { status: 500 });
  }
}
