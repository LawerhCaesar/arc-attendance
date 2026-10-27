import { NextRequest, NextResponse } from 'next/server';
import { requireFellowshipLeader } from '@/lib/fellowship-api';
import { memberApiFailure } from '@/lib/member-api';
import { MemberInputError } from '@/lib/member-scope';
import { assignUnassignedMember, listUnassignedMembers } from '@/lib/unassigned-members';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { admin } = await requireFellowshipLeader();
    return NextResponse.json(await listUnassignedMembers(admin), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, fellowship } = await requireFellowshipLeader();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MemberInputError('Select a valid unassigned member.');
    // No member details or destination are accepted from the browser.
    const member = await assignUnassignedMember(admin, body.memberId, fellowship);
    return NextResponse.json({ member });
  } catch (error) { return memberApiFailure(error); }
}
