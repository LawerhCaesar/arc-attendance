import { NextRequest, NextResponse } from 'next/server';
import { requireFellowshipAttendanceAccess } from '@/lib/fellowship-api';
import { memberApiFailure } from '@/lib/member-api';
import { fetchAllRows } from '@/lib/pagination';
import { dateInAccra } from '@/lib/birthdays';
import { fellowshipAttendanceReport, type HistoryMemberInput, type HistoryAttendanceInput } from '@/lib/fellowship-insights';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { admin, fellowship } = await requireFellowshipAttendanceAccess(request.nextUrl.searchParams.get('fellowship'));
    const [members, rows] = await Promise.all([
      fetchAllRows<HistoryMemberInput>((from, to) => admin.from('members').select('id,name,phone,fellowship,is_active,merged_into_id')
        .eq('fellowship', fellowship).is('merged_into_id', null).order('id').range(from, to)),
      fetchAllRows<HistoryAttendanceInput>((from, to) => admin.from('attendance').select('id,member_id,name,phone,fellowship,date,attendanceDate,attendanceStatus')
        .eq('fellowship', fellowship).order('id').range(from, to)),
    ]);
    return NextResponse.json(fellowshipAttendanceReport(members, rows, fellowship, dateInAccra()),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}
