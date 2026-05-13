import { NextResponse } from 'next/server';
import { getAttendanceData } from '@/lib/database';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getAttendanceData();

    // Filter first timers
    const firstTimersList: any[] = [];
    
    data.forEach(record => {
      const isFirstTimer = record.firstTimer && ['yes', 'true', '1'].includes(String(record.firstTimer).toLowerCase().trim());
      if (isFirstTimer) {
        firstTimersList.push({
          name: record.name,
          phone: record.phone || 'N/A',
          fellowship: record.fellowship || 'N/A',
          visitDate: record.attendanceDate || record.date,
        });
      }
    });

    // Sort by visitDate descending
    firstTimersList.sort((a, b) => b.visitDate.localeCompare(a.visitDate));

    return NextResponse.json({
      firstTimers: firstTimersList,
      totalCount: firstTimersList.length,
    });
  } catch (error: any) {
    console.error('Error fetching first timers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch first timers data' },
      { status: 500 }
    );
  }
}
