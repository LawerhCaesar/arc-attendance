import { NextRequest, NextResponse } from 'next/server';
import { appendAttendance, getAttendanceData, syncMemberFromAttendance } from '@/lib/database';

/**
 * Snaps a YYYY-MM-DD date string to the most recent Sunday (local time).
 * If the date is already a Sunday, returns it unchanged.
 */
function snapToSunday(isoDate: string): string {
  // Parse as local date to avoid UTC offset shifting the day
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - dayOfWeek);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      location,
      birthday,
      fellowship,
      firstTimer,
      designation,
      attendanceDate,
      attendanceStatus,
    } = body;

    // Name is required; fellowship/phone/birthday/location are optional
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Validate phone format only when provided
    if (phone) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(phone)) {
        return NextResponse.json(
          { error: 'Invalid phone format' },
          { status: 400 }
        );
      }
    }

    // Ensure attendanceDate is always a Sunday
    const rawDate = attendanceDate || new Date().toISOString().split('T')[0];
    const serviceSunday = snapToSunday(rawDate);

    const record = {
      date: new Date().toISOString().split('T')[0], // submission timestamp
      name: name.trim(),
      phone: (phone || '').trim(),
      location: (location || '').trim(),
      birthday: (birthday || '').trim(),
      fellowship: (fellowship || '').trim(),
      firstTimer: firstTimer === true || firstTimer === 'true' || firstTimer === 'yes' ? 'Yes' : 'No',
      designation: designation || 'Member',
      attendanceDate: serviceSunday,
      attendanceStatus: attendanceStatus || '',
    };

    await appendAttendance(record);
    await syncMemberFromAttendance(record);

    return NextResponse.json(
      { message: 'Attendance recorded successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error recording attendance:', error);
    return NextResponse.json(
      { error: 'Failed to record attendance. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const data = await getAttendanceData();

    const entries = data.map((record, index) => ({
      id: `record-${index}-${record.date}`,
      name: record.name,
      phone: record.phone,
      location: record.location,
      birthday: record.birthday,
      fellowship: record.fellowship,
      designation: record.designation || 'Member',
      firstTimer: record.firstTimer === 'Yes' || record.firstTimer === 'true' || record.firstTimer === 'yes',
      attendanceDate: record.attendanceDate,
      attendanceStatus: record.attendanceStatus,
    }));

    return NextResponse.json(entries);
  } catch (error: any) {
    console.error('Error fetching attendance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance data' },
      { status: 500 }
    );
  }
}
