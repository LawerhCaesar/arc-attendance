import { NextResponse } from 'next/server';
import { getAttendanceData } from '@/lib/google-sheets';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getAttendanceData();

    const totalAttendance = data.length;
    const uniqueVisitors = new Set(data.map(record => record.phone.toLowerCase().trim()).filter(phone => phone)).size;
    const repeatVisitors = totalAttendance - uniqueVisitors;

    // Calculate attendance by date
    const attendanceByDate: Record<string, number> = {};
    data.forEach(record => {
      const date = record.date;
      attendanceByDate[date] = (attendanceByDate[date] || 0) + 1;
    });

    const dates = Object.keys(attendanceByDate).sort();
    const latestDate = dates[dates.length - 1];
    const latestAttendance = latestDate ? attendanceByDate[latestDate] : 0;

    // Calculate average attendance per service
    const averageAttendance = dates.length > 0 
      ? Math.round(totalAttendance / dates.length) 
      : 0;

    return NextResponse.json({
      totalAttendance,
      uniqueVisitors,
      repeatVisitors,
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

