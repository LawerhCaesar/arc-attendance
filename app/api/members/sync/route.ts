import { NextRequest, NextResponse } from 'next/server';
import { createMembers } from '@/lib/database';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { parseMemberInput } from '@/lib/member-scope';
import { memberApiFailure } from '@/lib/member-api';

export async function POST(request: NextRequest) {
  let candidates: { name: string; phone: string }[] = [];
  try {
    const context = await getAuthContext();
    if (!context || !canAccess(context, 'members', 'entry', 'past-entry')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { members } = body;

    if (!Array.isArray(members)) {
      return NextResponse.json({ error: 'Members must be an array' }, { status: 400 });
    }

    // Validate the complete import before making any writes.
    const prepared = members.map(member => parseMemberInput({ ...member, designation: member?.designation || 'Member' }, context));
    candidates = prepared;
    await createMembers(prepared);

    return NextResponse.json({ message: 'Members imported successfully' }, { status: 200 });
  } catch (error) { return memberApiFailure(error, { phones: candidates.map(member => member.phone), candidates }); }
}
