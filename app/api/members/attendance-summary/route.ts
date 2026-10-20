import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { memberApiFailure } from '@/lib/member-api';
import { MemberInputError, memberFellowshipScope } from '@/lib/member-scope';
import { loadRosterAttendanceSummary } from '@/lib/roster-attendance-source';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) throw new MemberInputError('Sign in to view member attendance.',401);
    if (!canAccess(context,'members','absenteeism')) throw new MemberInputError('Member roster or absenteeism access required.',403);
    const summary = await loadRosterAttendanceSummary(memberFellowshipScope(context),canAccess(context,'members'));
    return NextResponse.json(summary,{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) { return memberApiFailure(error); }
}
