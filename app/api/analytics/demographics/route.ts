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

    // Location demographics
    const locationCounts: Record<string, number> = {};
    data.forEach(record => {
      const location = record.location.trim() || 'Unknown';
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    });

    const locationData = Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    // Birthday demographics (by month)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const birthdayMonths: Record<string, number> = {};
    monthNames.forEach(m => birthdayMonths[m] = 0);

    data.forEach(record => {
      if (record.birthday) {
        const parts = record.birthday.split('-');
        if (parts.length === 2) {
          const monthIndex = parseInt(parts[1], 10) - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            birthdayMonths[monthNames[monthIndex]]++;
          }
        } else if (record.birthday.includes('/')) {
            const parts = record.birthday.split('/');
            if (parts.length === 2) {
                const monthIndex = parseInt(parts[1], 10) - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    birthdayMonths[monthNames[monthIndex]]++;
                }
            }
        }
      }
    });

    const birthdayData = monthNames.map(month => ({
      month,
      count: birthdayMonths[month]
    })).filter(item => item.count > 0);

    return NextResponse.json({
      locations: locationData,
      birthdays: birthdayData,
    });
  } catch (error: any) {
    console.error('Error fetching demographics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demographics data' },
      { status: 500 }
    );
  }
}

