import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceData } from '@/lib/google-sheets';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly'; // weekly, monthly

    const data = await getAttendanceData();

    // Group by date
    const attendanceByDate: Record<string, number> = {};
    data.forEach(record => {
      const date = record.date;
      attendanceByDate[date] = (attendanceByDate[date] || 0) + 1;
    });

    let trends: Array<{ date: string; count: number }> = [];

    if (period === 'weekly') {
      // Group by week
      const weeklyData: Record<string, number> = {};
      Object.entries(attendanceByDate).forEach(([date, count]) => {
        const dateObj = new Date(date);
        const weekStart = new Date(dateObj);
        weekStart.setDate(dateObj.getDate() - dateObj.getDay()); // Start of week (Sunday)
        const weekKey = weekStart.toISOString().split('T')[0];
        weeklyData[weekKey] = (weeklyData[weekKey] || 0) + count;
      });

      trends = Object.entries(weeklyData)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } else {
      // Monthly
      const monthlyData: Record<string, number> = {};
      Object.entries(attendanceByDate).forEach(([date, count]) => {
        const monthKey = date.substring(0, 7); // YYYY-MM
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + count;
      });

      trends = Object.entries(monthlyData)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return NextResponse.json({ trends, period });
  } catch (error: any) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends data' },
      { status: 500 }
    );
  }
}

