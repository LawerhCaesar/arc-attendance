import { NextRequest, NextResponse } from 'next/server';
import { syncMemberFromAttendance } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { members } = body;

    if (!Array.isArray(members)) {
      return NextResponse.json({ error: 'Members must be an array' }, { status: 400 });
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
