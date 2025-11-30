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

    // Location demographics
    const locationCounts: Record<string, number> = {};
    data.forEach(record => {
      const location = record.location.trim() || 'Unknown';
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    });

    const locationData = Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    // Age demographics (calculate from birthday)
    const ageGroups: Record<string, number> = {
      '0-17': 0,
      '18-25': 0,
      '26-35': 0,
      '36-50': 0,
      '51-65': 0,
      '66+': 0,
    };

    const today = new Date();
    data.forEach(record => {
      if (record.birthday) {
        try {
          const birthDate = new Date(record.birthday);
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
            ? age - 1 
            : age;

          if (actualAge <= 17) ageGroups['0-17']++;
          else if (actualAge <= 25) ageGroups['18-25']++;
          else if (actualAge <= 35) ageGroups['26-35']++;
          else if (actualAge <= 50) ageGroups['36-50']++;
          else if (actualAge <= 65) ageGroups['51-65']++;
          else ageGroups['66+']++;
        } catch {
          // Invalid date, skip
        }
      }
    });

    const ageData = Object.entries(ageGroups)
      .map(([ageGroup, count]) => ({ ageGroup, count }))
      .filter(item => item.count > 0);

    return NextResponse.json({
      locations: locationData,
      ageGroups: ageData,
    });
  } catch (error: any) {
    console.error('Error fetching demographics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demographics data' },
      { status: 500 }
    );
  }
}

