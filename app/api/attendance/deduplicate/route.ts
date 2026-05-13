import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function POST() {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: records, error } = await supabase
      .from('attendance')
      .select('id, name, date, attendanceDate, createdAt')
      .order('createdAt', { ascending: true }); // Keep oldest

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const seen = new Set();
    const duplicates: string[] = [];

    for (const record of (records || [])) {
      const targetDate = record.attendanceDate || record.date;
      const key = `${record.name.trim().toLowerCase()}_${targetDate}`;

      if (seen.has(key)) {
        duplicates.push(record.id);
      } else {
        seen.add(key);
      }
    }

    if (duplicates.length > 0) {
      // Batch delete
      for (let i = 0; i < duplicates.length; i += 100) {
        const batch = duplicates.slice(i, i + 100);
        await supabase.from('attendance').delete().in('id', batch);
      }
      return NextResponse.json({ message: `Successfully removed ${duplicates.length} duplicate entries.` }, { status: 200 });
    }

    return NextResponse.json({ message: 'No duplicates found in the database.' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
