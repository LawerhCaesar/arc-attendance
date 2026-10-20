import { NextRequest, NextResponse } from 'next/server';
import { memberApiFailure, requireMemberAccess } from '@/lib/member-api';
import { MemberInputError, memberFellowshipScope, memberUuid } from '@/lib/member-scope';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let memberId = '';
  try {
    const context = await requireMemberAccess();
    const { id } = await params;
    memberId = id;
    if (!memberUuid.test(id)) throw new MemberInputError('Select a valid roster member.');
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== 'archive' && action !== 'restore') throw new MemberInputError('Choose archive or restore.');
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Member service unavailable.');
    const scope = memberFellowshipScope(context);
    let query = admin.from('members').update({ is_active: action === 'restore', updated_at: new Date().toISOString() })
      .eq('id', id).eq('is_active', action === 'archive').is('merged_into_id', null);
    if (scope) query = query.eq('fellowship', scope);
    const fields = 'id,name,phone,fellowship,designation,birthday,location,cell_id,bsct_group_id,is_active,updated_at';
    const { data, error } = await query.select(fields).maybeSingle();
    if (error) throw error;
    let member = data;
    if (!member) {
      // A different session may already have completed the same action. Return
      // that saved status so the caller can reconcile its stale roster row.
      let current = admin.from('members').select(fields).eq('id', id).is('merged_into_id', null);
      if (scope) current = current.eq('fellowship', scope);
      const { data: saved, error: readError } = await current.maybeSingle();
      if (readError) throw readError;
      if (!saved || saved.is_active !== (action === 'restore')) throw new MemberInputError('Member not found in your roster, or their status has changed. Refresh and try again.', 404);
      member = saved;
    }
    return NextResponse.json({ member, message: action === 'archive' ? 'Member archived. Attendance history is preserved.' : 'Member restored to the active roster.' },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error, { memberId, excludeId: memberId }); }
}
