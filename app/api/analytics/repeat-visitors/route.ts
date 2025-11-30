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

    // Count visits per phone number
    const visitorCounts: Record<string, { name: string; phone: string; count: number; lastVisit: string }> = {};
    
    data.forEach(record => {
      const phone = record.phone.toLowerCase().trim();
      if (!phone) return; // Skip records without phone
      
      if (!visitorCounts[phone]) {
        visitorCounts[phone] = {
          name: record.name,
          phone: record.phone,
          count: 0,
          lastVisit: record.date,
        };
      }
      visitorCounts[phone].count++;
      if (record.date > visitorCounts[phone].lastVisit) {
        visitorCounts[phone].lastVisit = record.date;
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

