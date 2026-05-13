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

    // Calculate attendance by date
    const attendanceByDate: Record<string, number> = {};
    let firstTimersCount = 0;
    
    data.forEach(record => {
      const date = record.attendanceDate || record.date;
      if (record.attendanceStatus === 'present' || !record.attendanceStatus) {
         attendanceByDate[date] = (attendanceByDate[date] || 0) + 1;
      }
      
      const isFirstTimer = record.firstTimer && ['yes', 'true', '1'].includes(String(record.firstTimer).toLowerCase().trim());
      if (isFirstTimer) {
        firstTimersCount++;
      }
    });

    const dates = Object.keys(attendanceByDate).sort();
    const highestAttendance = dates.length > 0 ? Math.max(...Object.values(attendanceByDate)) : 0;
    const latestDate = dates[dates.length - 1];
    const latestAttendance = latestDate ? attendanceByDate[latestDate] : 0;

    // Calculate average attendance per service
    // Ensure we count dates.length for average. We also need total attendance for average calculation.
    const totalAttendance = Object.values(attendanceByDate).reduce((sum, curr) => sum + curr, 0);
    const averageAttendance = dates.length > 0 
      ? Math.round(totalAttendance / dates.length) 
      : 0;

    return NextResponse.json({
      highestAttendance,
      firstTimersCount,
      totalServices: dates.length,
      latestDate,
      latestAttendance,
      averageAttendance,
    });
  } catch (error: any) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary data' },
      { status: 500 }
    );
  }
}
