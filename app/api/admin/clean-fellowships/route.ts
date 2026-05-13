import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { matchFellowship } from '@/lib/fellowships';

export async function POST() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let updatedAttendanceCount = 0;
    let updatedMembersCount = 0;

    // 1. Process attendance table
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('id, fellowship');

    if (attendanceError) throw attendanceError;

    for (const record of attendanceData || []) {
      const matched = matchFellowship(record.fellowship);
      if (matched !== record.fellowship) {
        await supabase
          .from('attendance')
          .update({ fellowship: matched })
          .eq('id', record.id);
        updatedAttendanceCount++;
      }
    }

    // 2. Process members table
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('id, fellowship');

    if (membersError) throw membersError;

    for (const member of membersData || []) {
      const matched = matchFellowship(member.fellowship);
      if (matched !== member.fellowship) {
        await supabase
          .from('members')
          .update({ fellowship: matched })
          .eq('id', member.id);
        updatedMembersCount++;
      }
    }

    return NextResponse.json({
      message: 'Fellowship names cleaned successfully',
      stats: {
        updatedAttendanceCount,
        updatedMembersCount
      }
    });

  } catch (error: any) {
    console.error('Error cleaning fellowships:', error);
    return NextResponse.json(
      { error: `Failed to clean fellowships: ${error.message}` },
      { status: 500 }
    );
  }
}
