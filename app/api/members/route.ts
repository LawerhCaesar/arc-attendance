import { NextRequest, NextResponse } from 'next/server';
import { getMembers, createMember } from '@/lib/database';
import { getAuthContext } from '@/lib/auth';
import { memberApiFailure, requireMemberAccess } from '@/lib/member-api';
import { memberFellowshipScope, parseMemberInput } from '@/lib/member-scope';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext();

    const { searchParams } = new URL(request.url);
    const designation = searchParams.get('designation') || undefined;
    const requestedFellowship = searchParams.get('fellowship') || undefined;
    const fellowship = memberFellowshipScope(context) || requestedFellowship;

    const members = await getMembers(designation, fellowship);
    return NextResponse.json(members);
  } catch (error) { return memberApiFailure(error); }
}

export async function POST(request: NextRequest) {
  let phone = '';
  try {
    const context = await requireMemberAccess();
    const input = parseMemberInput(await request.json(), context);
    phone = input.phone;
    const member = await createMember(input);

    return NextResponse.json(member, { status: 201 });
  } catch (error) { return memberApiFailure(error, { phones: [phone] }); }
}
