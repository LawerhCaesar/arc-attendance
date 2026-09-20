import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthContext } from '@/lib/auth';

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

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching attendance by date:', error);
    return NextResponse.json(
      { error: `Failed to fetch records: ${error.message}` },
      { status: 500 }
    );
  }

  const records = (data || []).map((record, index) => ({
    id: record.id || `record-${index}-${record.name}`,
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
