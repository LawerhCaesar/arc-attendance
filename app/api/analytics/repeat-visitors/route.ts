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

    // Count visits per email
    const visitorCounts: Record<string, { name: string; email: string; count: number; lastVisit: string }> = {};
    
    data.forEach(record => {
      const email = record.email.toLowerCase();
      if (!visitorCounts[email]) {
        visitorCounts[email] = {
          name: record.name,
          email: record.email,
          count: 0,
          lastVisit: record.date,
        };
      }
      visitorCounts[email].count++;
      if (record.date > visitorCounts[email].lastVisit) {
        visitorCounts[email].lastVisit = record.date;
      }
    });

    // Filter repeat visitors (more than 1 visit)
    const repeatVisitors = Object.values(visitorCounts)
      .filter(visitor => visitor.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 repeat visitors

    // Statistics
    const totalUniqueVisitors = Object.keys(visitorCounts).length;
    const totalRepeatVisitors = repeatVisitors.length;
    const averageVisits = totalUniqueVisitors > 0
      ? (data.length / totalUniqueVisitors).toFixed(2)
      : '0';

    return NextResponse.json({
      repeatVisitors,
      statistics: {
        totalUniqueVisitors,
        totalRepeatVisitors,
        averageVisits: parseFloat(averageVisits),
      },
    });
  } catch (error: any) {
    console.error('Error fetching repeat visitors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repeat visitors data' },
      { status: 500 }
    );
  }
}

