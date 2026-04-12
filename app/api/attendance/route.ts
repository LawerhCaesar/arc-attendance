import { NextRequest, NextResponse } from 'next/server';
import { appendAttendance, getAttendanceData } from '@/lib/database';

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

    // Name and fellowship are required; phone/birthday/location optional for roster-based submissions
    if (!name || !fellowship) {
      return NextResponse.json(
        { error: 'Name and fellowship are required' },
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

    const record = {
      date: new Date().toISOString().split('T')[0],
      name: name.trim(),
      phone: (phone || '').trim(),
      location: (location || '').trim(),
      birthday: (birthday || '').trim(),
      fellowship: fellowship.trim(),
      firstTimer: firstTimer === true || firstTimer === 'true' || firstTimer === 'yes' ? 'Yes' : 'No',
      designation: designation || 'Member',
      attendanceDate: attendanceDate || '',
      attendanceStatus: attendanceStatus || '',
    };

    await appendAttendance(record);

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
