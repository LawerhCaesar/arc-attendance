import { NextResponse } from 'next/server';
import { requireMemberAccess, memberApiFailure } from '@/lib/member-api';
import { memberFellowshipScope } from '@/lib/member-scope';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/pagination';
import { dateInAccra } from '@/lib/birthdays';
import { rosterAttendanceSummary, type ServiceCalendarRow } from '@/lib/roster-attendance';
import type { HistoryAttendanceInput, HistoryMemberInput } from '@/lib/fellowship-insights';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const context = await requireMemberAccess();
    const scope = memberFellowshipScope(context);
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Roster attendance unavailable.');
    let memberQuery = admin.from('members').select('id,name,phone,fellowship,is_active,merged_into_id').is('merged_into_id',null).order('id');
    let attendanceQuery = admin.from('attendance').select('id,member_id,name,phone,fellowship,date,attendanceDate,attendanceStatus').order('id');
    if (scope) {
      memberQuery = memberQuery.eq('fellowship',scope);
      attendanceQuery = attendanceQuery.eq('fellowship',scope);
    }
    const [members,rows,calendar] = await Promise.all([
      fetchAllRows<HistoryMemberInput>((from,to) => memberQuery.range(from,to)),
      fetchAllRows<HistoryAttendanceInput>((from,to) => attendanceQuery.range(from,to)),
      // Only date/status fields cross fellowship boundaries, to use the same
      // eight church service dates even when a fellowship has no entries.
      fetchAllRows<ServiceCalendarRow>((from,to) => admin.from('attendance').select('date,attendanceDate,attendanceStatus').order('id').range(from,to)),
    ]);
    return NextResponse.json(rosterAttendanceSummary(members,rows,calendar,dateInAccra()),{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) { return memberApiFailure(error); }
}
