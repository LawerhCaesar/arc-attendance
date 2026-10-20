import { NextResponse } from 'next/server';
import { memberApiFailure, requireMemberAccess } from '@/lib/member-api';
import { memberFellowshipScope } from '@/lib/member-scope';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/pagination';
import type { Member } from '@/lib/database';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const context = await requireMemberAccess();
    const fellowship = memberFellowshipScope(context);
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Member service unavailable.');
    let query = admin.from('members').select('id,name,phone,fellowship,designation,birthday,location,updated_at')
      .eq('is_active', false).is('merged_into_id', null).order('name').order('id');
    if (fellowship) query = query.eq('fellowship', fellowship);
    const members = await fetchAllRows<Member>((from, to) => query.range(from, to));
    return NextResponse.json(members, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}
