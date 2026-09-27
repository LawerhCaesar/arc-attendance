import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import {
  duplicateCandidateForPair,
  duplicatePairKey,
  findMemberDuplicateCandidates,
  groupMemberDuplicateCandidates,
  type DuplicateMember,
} from '@/lib/member-duplicates';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/pagination';
import { evaluateMemberMerge } from '@/lib/member-merge-state';

export const dynamic = 'force-dynamic';
const liveHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };
interface ReviewedMember extends DuplicateMember { is_active: boolean; merged_into_id?: string | null }

async function loadReviewedMembers(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, ids: string[]) {
  const members: ReviewedMember[] = [];
  // Keep URLs short, and load only the selected group, including already-merged
  // records so a completed request can be retried safely.
  for (let start = 0; start < ids.length; start += 400) {
    const batches: PromiseLike<{ data: ReviewedMember[] | null; error: { message: string } | null }>[] = [];
    for (let offset = start; offset < Math.min(start + 400, ids.length); offset += 100) {
      batches.push(admin.from('members')
        .select('id, name, phone, fellowship, designation, birthday, location, created_at, is_active, merged_into_id')
        .in('id', ids.slice(offset, offset + 100)));
    }
    for (const result of await Promise.all(batches)) {
      if (result.error) throw new Error(result.error.message);
      members.push(...(result.data || []));
    }
  }
  return members;
}

function orderedIds(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

async function loadActiveMembers(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, ids?: string[]) {
  let query = admin
    .from('members')
    .select('id, name, phone, fellowship, designation, birthday, location, created_at')
    .eq('is_active', true);
  if (ids) query = query.in('id', ids);
  return fetchAllRows<DuplicateMember>((from, to) => query.order('name').order('id').range(from, to));
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext();
    if (!context || context.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' }, { status: 503 });

    const [members, decisions] = await Promise.all([
      loadActiveMembers(admin),
      fetchAllRows<{ member_a_id: string; member_b_id: string }>((from, to) => admin
        .from('member_duplicate_decisions').select('member_a_id, member_b_id').order('id').range(from, to)),
    ]);
    const ignored = new Set(decisions.map(row => duplicatePairKey(row.member_a_id, row.member_b_id)));
    const candidates = findMemberDuplicateCandidates(members, ignored);
    const groups = groupMemberDuplicateCandidates(candidates);
    const requestedPage = Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
    const requestedPageSize = Number.parseInt(request.nextUrl.searchParams.get('pageSize') || '5', 10);
    const pageSize = Math.min(10, Math.max(1, Number.isFinite(requestedPageSize) ? requestedPageSize : 5));
    const totalCandidates = candidates.length;
    const totalGroups = groups.length;
    const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
    const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
    const start = (page - 1) * pageSize;
    const pageGroups = groups.slice(start, start + pageSize).map(group => ({
      ...group,
      matches: group.matches.slice(0, 20),
    }));

    return NextResponse.json({
      groups: pageGroups,
      totalCandidates,
      totalGroups,
      scannedMembers: members.length,
      page,
      pageSize,
      totalPages,
    }, { headers: liveHeaders });
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
    const fallbackIds = [body.memberAId, body.memberBId].filter(Boolean);
    const memberIds: string[] = Array.from(new Set<string>(
      (Array.isArray(body.memberIds) ? body.memberIds : fallbackIds).map((id: unknown) => String(id || '')).filter(Boolean),
    ));
    const anchorId = String(body.anchorId || body.memberAId || '');
    if (!['keep_separate', 'merge'].includes(action) || memberIds.length < 2 || !anchorId || !memberIds.includes(anchorId)) {
      return NextResponse.json({ error: 'A valid duplicate group and decision are required' }, { status: 400 });
    }

    const primaryId = String(body.primaryId || '');
    if (action === 'merge' && !memberIds.includes(primaryId)) {
      return NextResponse.json({ error: 'Select which member record should remain primary' }, { status: 400 });
    }
    const members = await loadReviewedMembers(admin, memberIds);
    const mergeState = evaluateMemberMerge(members, memberIds, primaryId);
    const stale = () => NextResponse.json({
      error: 'This group changed after it was loaded. The review has been refreshed; check the remaining matches.',
      refreshRequired: true,
    }, { status: 409, headers: liveHeaders });
    const completed = () => NextResponse.json({
      success: true, action, primaryId, mergedRecords: 0, alreadyMerged: true,
      message: 'This group has already been merged successfully.',
    }, { headers: liveHeaders });
    if (action === 'merge' && mergeState.state === 'complete') return completed();
    if (members.length !== memberIds.length || (action === 'merge' && mergeState.state === 'stale') ||
      (action === 'keep_separate' && members.some(member => !member.is_active))) return stale();
    const anchor = members.find(member => member.id === anchorId)!;
    const matches = members.filter(member => member.id !== anchorId && member.is_active).map(member => ({
      member,
      candidate: duplicateCandidateForPair(anchor, member),
    }));
    if (matches.some(match => !match.candidate)) {
      return NextResponse.json({ error: 'Some records no longer meet the duplicate-review threshold' }, { status: 409 });
    }

    if (action === 'keep_separate') {
      const decisions = matches.map(({ member, candidate }) => {
        const [memberAId, memberBId] = orderedIds(anchorId, member.id);
        return {
          member_a_id: memberAId,
          member_b_id: memberBId,
          decision: 'keep_separate',
          primary_member_id: null,
          decided_by: context.username,
          reason_snapshot: candidate,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await admin.from('member_duplicate_decisions').upsert(decisions, {
        onConflict: 'member_a_id,member_b_id',
      });
      if (error) throw error;
      return NextResponse.json({ success: true, action, affectedRecords: memberIds.length });
    }

    const secondaryIds = mergeState.secondaryIds;
    const groupSummary = {
      anchorId,
      memberCount: memberIds.length,
      minMatchScore: Math.min(...matches.map(match => match.candidate!.score)),
    };
    const { error } = await admin.rpc('merge_legacy_member_group', {
      p_primary_id: primaryId,
      p_secondary_ids: secondaryIds,
      p_decided_by: context.username,
      p_reason_snapshot: groupSummary,
    });
    if (error) {
      // Another request may have committed while this request was in flight.
      const current = await loadReviewedMembers(admin, memberIds);
      const currentState = evaluateMemberMerge(current, memberIds, primaryId);
      if (currentState.state === 'complete') return completed();
      if (currentState.state === 'stale' || error.code === 'P0001') return stale();
      throw error;
    }
    return NextResponse.json({
      success: true,
      action,
      primaryId,
      mergedRecords: secondaryIds.length,
    });
  } catch (error) {
    console.error('Error resolving member duplicates:', error);
    return NextResponse.json({ error: 'Failed to save the duplicate decision' }, { status: 500 });
  }
}
