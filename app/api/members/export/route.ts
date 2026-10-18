import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { getMembers } from '@/lib/database';
import { dateInAccra } from '@/lib/birthdays';
import { buildMemberExport } from '@/lib/member-export';
import { memberApiFailure } from '@/lib/member-api';
import { memberFellowshipScope } from '@/lib/member-scope';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) return NextResponse.json({ error: 'Sign in again to export members.' }, { status: 401 });
    if (!canAccess(context, 'members')) {
      return NextResponse.json({ error: 'Your role does not have Member Roster access.' }, { status: 403 });
    }
    // Fetch the full permitted active roster, not the browser's search/filter results.
    const members = await getMembers(undefined, memberFellowshipScope(context));
    return new NextResponse(buildMemberExport(members), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="members-${dateInAccra()}.xlsx"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error) { return memberApiFailure(error); }
}
