import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAttendanceData, getMembers } from '@/lib/database';
import { buildPastoralDashboard } from '@/lib/pastoral-dashboard';

export async function GET() {
  try {
    if (!(await isAuthenticated(['admin', 'pastor']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [attendance, members] = await Promise.all([
      getAttendanceData(),
      getMembers(),
    ]);

    return NextResponse.json(buildPastoralDashboard(attendance, members));
  } catch (error) {
    console.error('Error building pastoral dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to build pastoral dashboard' },
      { status: 500 }
    );
  }
}
