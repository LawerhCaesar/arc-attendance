import { NextRequest, NextResponse } from 'next/server';
import { requireFellowshipAttendanceAccess } from '@/lib/fellowship-api';
import { memberApiFailure } from '@/lib/member-api';
import { fetchAllRows } from '@/lib/pagination';
import { dateInAccra } from '@/lib/birthdays';
import { fellowshipAttendanceReport, type HistoryMemberInput } from '@/lib/fellowship-insights';
import { loadRosterAttendanceSummary } from '@/lib/roster-attendance-source';
import { loadFellowshipHistoryRows } from '@/lib/fellowship-history-source';
import { loadFellowshipStructure } from '@/lib/fellowship-structure-source';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { admin, fellowship } = await requireFellowshipAttendanceAccess(request.nextUrl.searchParams.get('fellowship'));
    const membersPromise = fetchAllRows<HistoryMemberInput>((from, to) => admin.from('members').select('id,name,phone,fellowship,is_active,merged_into_id,cell_id,bsct_group_id')
      .eq('fellowship', fellowship).is('merged_into_id', null).order('id').range(from, to));
    const [members, rows, attendanceSummary, structure] = await Promise.all([
      membersPromise,
      membersPromise.then(members => loadFellowshipHistoryRows(admin, members, fellowship)),
      loadRosterAttendanceSummary(fellowship,false),
      loadFellowshipStructure(admin, fellowship),
    ]);
    return NextResponse.json({...fellowshipAttendanceReport(members, rows, fellowship, dateInAccra()),attendanceSummary,structure},
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}
