import { NextRequest, NextResponse } from 'next/server';
import { syncMemberFromAttendance } from '@/lib/database';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';

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

    if (context.role === 'fellowship_leader' && (
      !context.fellowship || members.some(member => member.fellowship !== context.fellowship)
    )) {
      return NextResponse.json({ error: 'Outside your fellowship scope' }, { status: 403 });
    }

    // Sync each member into the database
    for (const member of members) {
      if (member.name) {
        await syncMemberFromAttendance({
          date: new Date().toISOString().split('T')[0],
          name: member.name.trim(),
          phone: (member.phone || '').trim(),
          location: (member.location || '').trim(),
          birthday: (member.birthday || '').trim(),
          fellowship: (member.fellowship || '').trim(),
          firstTimer: member.firstTimer ? 'Yes' : 'No',
          designation: member.designation || 'Member',
        });
      }
    }

    return NextResponse.json({ message: 'Members synced successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error syncing members:', error);
    return NextResponse.json({ error: 'Failed to sync members' }, { status: 500 });
  }
}
