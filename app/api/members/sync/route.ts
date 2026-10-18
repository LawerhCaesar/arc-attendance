import { NextRequest, NextResponse } from 'next/server';
import { syncMemberFromAttendance } from '@/lib/database';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { memberFellowshipScope, parseMemberInput } from '@/lib/member-scope';
import { memberApiFailure } from '@/lib/member-api';

export async function POST(request: NextRequest) {
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

    const scope = memberFellowshipScope(context);
    // Validate the complete import before making any writes.
    const prepared = members.map(member => parseMemberInput({ ...member, designation: member?.designation || 'Member' }, context));

    // Sync each member into the database
    for (const member of prepared) {
      if (member.name) {
        await syncMemberFromAttendance({
          date: new Date().toISOString().split('T')[0],
          name: member.name.trim(),
          phone: (member.phone || '').trim(),
          location: (member.location || '').trim(),
          birthday: (member.birthday || '').trim(),
          fellowship: (member.fellowship || '').trim(),
          firstTimer: 'No',
          designation: member.designation || 'Member',
        }, undefined, scope);
      }
    }

    return NextResponse.json({ message: 'Members synced successfully' }, { status: 200 });
  } catch (error) { return memberApiFailure(error); }
}
