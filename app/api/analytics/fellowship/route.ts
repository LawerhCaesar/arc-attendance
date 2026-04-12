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

    // Group records by fellowship
    const fellowshipMap: Record<
      string,
      {
        total: number;
        present: number;
        absent: number;
        designations: Record<string, number>;
        uniquePhones: Set<string>;
        dates: Set<string>;
        recentDate: string;
      }
    > = {};

    data.forEach(record => {
      const fellowship = record.fellowship?.trim() || 'Unknown';

      if (!fellowshipMap[fellowship]) {
        fellowshipMap[fellowship] = {
          total: 0,
          present: 0,
          absent: 0,
          designations: {},
          uniquePhones: new Set(),
          dates: new Set(),
          recentDate: '',
        };
      }

      const f = fellowshipMap[fellowship];
      f.total++;

      if (record.attendanceStatus === 'present') f.present++;
      else if (record.attendanceStatus === 'absent') f.absent++;

      const designation = record.designation || 'Member';
      f.designations[designation] = (f.designations[designation] || 0) + 1;

      if (record.phone?.trim()) f.uniquePhones.add(record.phone.trim().toLowerCase());
      if (record.date) {
        f.dates.add(record.date);
        if (!f.recentDate || record.date > f.recentDate) {
          f.recentDate = record.date;
        }
      }
    });

    const fellowships = Object.entries(fellowshipMap)
      .map(([name, d]) => ({
        name,
        total: d.total,
        present: d.present,
        absent: d.absent,
        attendanceRate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
        uniquePersons: d.uniquePhones.size,
        totalServices: d.dates.size,
        recentDate: d.recentDate,
        designations: d.designations,
      }))
      .sort((a, b) => b.total - a.total);

    // Cell-leader specific stats from attendance records
    const cellLeaderRecords = data.filter(
      r => r.designation === 'Cell Leader'
    );

    const clMap: Record<
      string,
      { name: string; fellowship: string; present: number; total: number; lastPresent: string }
    > = {};

    cellLeaderRecords.forEach(r => {
      const key = r.phone?.trim() || r.name.trim();
      if (!clMap[key]) {
        clMap[key] = {
          name: r.name,
          fellowship: r.fellowship || '',
          present: 0,
          total: 0,
          lastPresent: '',
        };
      }
      clMap[key].total++;
      if (r.attendanceStatus === 'present') {
        clMap[key].present++;
        if (!clMap[key].lastPresent || (r.date || '') > clMap[key].lastPresent) {
          clMap[key].lastPresent = r.date || '';
        }
      }
    });

    const cellLeaders = Object.values(clMap)
      .map(cl => ({
        ...cl,
        attendanceRate: cl.total > 0 ? Math.round((cl.present / cl.total) * 100) : 0,
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    return NextResponse.json({
      fellowships,
      totalFellowships: fellowships.length,
      cellLeaders,
    });
  } catch (error: any) {
    console.error('Error fetching fellowship data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fellowship data' },
      { status: 500 }
    );
  }
}
