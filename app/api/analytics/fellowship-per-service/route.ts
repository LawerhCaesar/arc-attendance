import { NextResponse } from 'next/server';
import { getAttendanceData } from '@/lib/database';
import { isAuthenticated } from '@/lib/auth';
import { FELLOWSHIPS } from '@/lib/fellowships';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getAttendanceData();

    // Build a map: serviceDate -> fellowship -> { present, total }
    const serviceMap: Record<
      string,
      Record<string, { present: number; total: number }>
    > = {};

    data.forEach(record => {
      const serviceDate = record.attendanceDate || record.date;
      if (!serviceDate) return;

      const fellowship = record.fellowship?.trim() || 'Unknown';

      if (!serviceMap[serviceDate]) {
        serviceMap[serviceDate] = {};
      }
      if (!serviceMap[serviceDate][fellowship]) {
        serviceMap[serviceDate][fellowship] = { present: 0, total: 0 };
      }

      serviceMap[serviceDate][fellowship].total++;
      if (record.attendanceStatus === 'present') {
        serviceMap[serviceDate][fellowship].present++;
      }
    });

    // Collect all fellowships seen across all services
    const allFellowships = Array.from(
      new Set([
        ...FELLOWSHIPS,
        ...Object.values(serviceMap).flatMap(f => Object.keys(f)),
      ])
    ).filter(f => {
      // Only include fellowships that have at least one record
      return Object.values(serviceMap).some(s => s[f]?.total > 0);
    });

    // Sort services by date ascending
    const services = Object.keys(serviceMap).sort((a, b) => a.localeCompare(b));

    // Build response rows
    const rows = services.map(date => {
      const fellowshipCounts: Record<string, { present: number; total: number; rate: number }> = {};
      let totalPresent = 0;
      let totalAttendees = 0;

      allFellowships.forEach(f => {
        const entry = serviceMap[date][f] || { present: 0, total: 0 };
        fellowshipCounts[f] = {
          present: entry.present,
          total: entry.total,
          rate: entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0,
        };
        totalPresent += entry.present;
        totalAttendees += entry.total;
      });

      return {
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        fellowships: fellowshipCounts,
        totalPresent,
        totalAttendees,
        overallRate: totalAttendees > 0 ? Math.round((totalPresent / totalAttendees) * 100) : 0,
      };
    });

    return NextResponse.json({
      services: rows,
      fellowships: allFellowships,
    });
  } catch (error: any) {
    console.error('Error fetching fellowship-per-service data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fellowship per service data' },
      { status: 500 }
    );
  }
}
