import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { dateInAccra, upcomingBirthdays } from '@/lib/birthdays';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/pagination';
import { MemberInputError, memberFellowshipScope } from '@/lib/member-scope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Sign in to view upcoming birthdays.' }, { status: 401 });
  if (context.role !== 'fellowship_leader') return NextResponse.json({ error: 'Fellowship leader access required.' }, { status: 403 });
  try {
    // Scope comes only from the verified account, never from URL parameters.
    const fellowship = memberFellowshipScope(context)!;
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Birthday service unavailable.');
    const members = await fetchAllRows<{ id: string; name: string; birthday: string | null }>((from, to) => admin
      .from('members').select('id,name,birthday').eq('is_active', true).eq('fellowship', fellowship)
      .order('id').range(from, to));
    const today = dateInAccra();
    const windowDays = 60;
    return NextResponse.json({ fellowship, today, windowDays, birthdays: upcomingBirthdays(members, today, windowDays) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof MemberInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Account birthdays failed:', error instanceof Error ? error.message : 'Birthday lookup failed');
    return NextResponse.json({ error: 'Unable to load upcoming birthdays. Please try again.' }, { status: 503 });
  }
}
