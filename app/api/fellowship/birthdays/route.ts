import { NextResponse } from 'next/server';
import { requireFellowshipLeader } from '@/lib/fellowship-api';
import { memberApiFailure } from '@/lib/member-api';
import { fetchAllRows } from '@/lib/pagination';
import { dateInAccra } from '@/lib/birthdays';
import { fellowshipBirthdayDirectory } from '@/lib/fellowship-insights';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { admin, fellowship } = await requireFellowshipLeader();
    const members = await fetchAllRows<{ id: string; name: string; birthday: string | null }>((from, to) => admin.from('members')
      .select('id,name,birthday').eq('fellowship', fellowship).eq('is_active', true).order('id').range(from, to));
    const today = dateInAccra();
    return NextResponse.json({ fellowship, today, members: fellowshipBirthdayDirectory(members, today) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}
