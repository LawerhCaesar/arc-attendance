import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getAttendanceData } from '@/lib/database';
import { consolidateLinkedAttendance } from '@/lib/attendance-identity';

/** Legacy cleanup URL now verifies logical consolidation without deleting evidence. */
export async function POST() {
  const context = await getAuthContext();
  if (context?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: context ? 403 : 401 });
  try {
    const rows = await getAttendanceData({ preserveOverlaps: true });
    const consolidated = consolidateLinkedAttendance(rows);
    const overlaps = rows.length - consolidated.length;
    return NextResponse.json({ overlaps, deletedRecords: 0,
      message: `${overlaps} overlapping attendance entries are counted once per linked member and service. Present evidence takes precedence over absent. All stored history is preserved. Use Member Roster to review and merge separate member records.` },
    { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Attendance totals could not be checked.' }, { status: 503 }); }
}
