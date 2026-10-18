import { NextRequest, NextResponse } from 'next/server';
import { getMember, updateMember, deleteMember } from '@/lib/database';
import { memberApiFailure, requireMemberAccess } from '@/lib/member-api';
import { MemberInputError, memberFellowshipScope, memberUuid, parseMemberInput } from '@/lib/member-scope';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireMemberAccess();
    const { id } = await params;
    if (!memberUuid.test(id)) throw new MemberInputError('Select a valid roster member.');
    const scope = memberFellowshipScope(context);
    const member = await getMember(id, scope);
    if (!member) return NextResponse.json({ error: 'Member not found in your roster.' }, { status: 404 });
    return NextResponse.json({ member, fellowshipScope: scope || null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireMemberAccess();
    const { id } = await params;
    const member = await updateMember(id, parseMemberInput(await request.json(), context), memberFellowshipScope(context));
    if (!member) return NextResponse.json({ error: 'Member not found in your roster.' }, { status: 404 });
    return NextResponse.json(member);
  } catch (error) { return memberApiFailure(error); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireMemberAccess();
    const { id } = await params;
    if (!await deleteMember(id, memberFellowshipScope(context))) {
      return NextResponse.json({ error: 'Member not found in your roster.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) { return memberApiFailure(error); }
}
