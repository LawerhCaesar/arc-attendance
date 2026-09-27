import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthContext } from '@/lib/auth';
import { fetchAllRows } from '@/lib/pagination';
import { consolidateLinkedAttendance } from '@/lib/attendance-identity';
import type { AttendanceRecord } from '@/lib/database';

/**
 * GET /api/attendance/by-date?date=YYYY-MM-DD
 * Returns all attendance records for a specific attendanceDate (must be a Sunday).
 */
export async function GET(request: NextRequest) {
  const context = await getAuthContext();
  if (!context || !['admin', 'pastor', 'attendance', 'fellowship_leader'].includes(context.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'A valid date query parameter (YYYY-MM-DD) is required.' },
      { status: 400 }
    );
  }

  let query = supabase
    .from('attendance')
    .select('*')
    .eq('attendanceDate', date)
    .order('fellowship', { ascending: true })
    .order('name', { ascending: true });

  if (context.role === 'fellowship_leader') {
    if (!context.fellowship) {
      return NextResponse.json({ error: 'No fellowship scope configured' }, { status: 403 });
    }
    query = query.eq('fellowship', context.fellowship);
  }

  let data: AttendanceRecord[];
  try {
    data = await fetchAllRows<AttendanceRecord>((from, to) => query.order('id').range(from, to));
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
      { status: 500 }
    );
  }

  const records = consolidateLinkedAttendance(data).map((record, index) => ({
    id: record.id || `record-${index}-${record.name}`,
    member_id: record.member_id,
    name: record.name,
    phone: record.phone || '',
    location: record.location || '',
    birthday: record.birthday || '',
    fellowship: record.fellowship || '',
    designation: record.designation || 'Member',
    firstTimer: record.firstTimer === 'Yes' || record.firstTimer === 'true' || record.firstTimer === 'yes',
    attendanceDate: record.attendanceDate,
    attendanceStatus: record.attendanceStatus || '',
  }));

  return NextResponse.json(records);
}
