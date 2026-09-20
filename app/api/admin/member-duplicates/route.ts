import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import {
  duplicateCandidateForPair,
  duplicatePairKey,
  findMemberDuplicateCandidates,
  type DuplicateMember,
} from '@/lib/member-duplicates';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function orderedIds(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

async function loadActiveMembers(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, ids?: string[]) {
  let query = admin
    .from('members')
    .select('id, name, phone, fellowship, designation, birthday, location, created_at')
    .eq('is_active', true);
  if (ids) query = query.in('id', ids);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data || []) as DuplicateMember[];
}

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context || context.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' }, { status: 503 });

    const [members, decisionsResult] = await Promise.all([
      loadActiveMembers(admin),
      admin.from('member_duplicate_decisions').select('member_a_id, member_b_id'),
    ]);
    if (decisionsResult.error) {
      return NextResponse.json({ error: 'Apply the member duplicate review migration first' }, { status: 503 });
    }
    const ignored = new Set((decisionsResult.data || []).map(row => duplicatePairKey(row.member_a_id, row.member_b_id)));
    const candidates = findMemberDuplicateCandidates(members, ignored);
    return NextResponse.json({ candidates, scannedMembers: members.length });
  } catch (error) {
    console.error('Error scanning member duplicates:', error);
    return NextResponse.json({ error: 'Failed to scan the member roster' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext();
    if (!context || context.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' }, { status: 503 });

    const body = await request.json();
    const action = body.action as 'keep_separate' | 'merge';
    const memberAId = String(body.memberAId || '');
    const memberBId = String(body.memberBId || '');
    if (!['keep_separate', 'merge'].includes(action) || !memberAId || !memberBId || memberAId === memberBId) {
      return NextResponse.json({ error: 'Two different members and a valid decision are required' }, { status: 400 });
    }

    const members = await loadActiveMembers(admin, [memberAId, memberBId]);
    if (members.length !== 2) return NextResponse.json({ error: 'Both active members could not be found' }, { status: 404 });
    const memberA = members.find(member => member.id === memberAId)!;
    const memberB = members.find(member => member.id === memberBId)!;
    const candidate = duplicateCandidateForPair(memberA, memberB);
    if (!candidate) return NextResponse.json({ error: 'These records no longer meet the duplicate-review threshold' }, { status: 409 });
    const [orderedA, orderedB] = orderedIds(memberAId, memberBId);

    if (action === 'keep_separate') {
      const { error } = await admin.from('member_duplicate_decisions').upsert({
        member_a_id: orderedA,
        member_b_id: orderedB,
        decision: 'keep_separate',
        primary_member_id: null,
        decided_by: context.username,
        reason_snapshot: candidate,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_a_id,member_b_id' });
      if (error) throw error;
      return NextResponse.json({ success: true, action });
    }

    const primaryId = String(body.primaryId || '');
    if (![memberAId, memberBId].includes(primaryId)) {
      return NextResponse.json({ error: 'Select which member record should remain primary' }, { status: 400 });
    }
    const secondaryId = primaryId === memberAId ? memberBId : memberAId;
    const { error } = await admin.rpc('merge_legacy_members', {
      p_primary_id: primaryId,
      p_secondary_id: secondaryId,
      p_decided_by: context.username,
      p_reason_snapshot: candidate,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, action, primaryId, secondaryId });
  } catch (error) {
    console.error('Error resolving member duplicates:', error);
    return NextResponse.json({ error: 'Failed to save the duplicate decision' }, { status: 500 });
  }
}
