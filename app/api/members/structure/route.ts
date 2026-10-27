import { NextRequest, NextResponse } from 'next/server';
import { requireMemberAccess, memberApiFailure } from '@/lib/member-api';
import { assertFellowshipAccess, MemberInputError, memberFellowshipScope, memberUuid } from '@/lib/member-scope';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadFellowshipStructure } from '@/lib/fellowship-structure-source';

export async function GET() {
  try {
    const context = await requireMemberAccess();
    const admin = getSupabaseAdmin();
    if (!admin) throw new MemberInputError('Fellowship management requires server configuration.', 503);
    const scope = memberFellowshipScope(context);
    return NextResponse.json(await loadFellowshipStructure(admin, scope), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return memberApiFailure(error); }
}

async function save(request: NextRequest, editing: boolean) {
  try {
    const context = await requireMemberAccess();
    const body = await request.json();
    if (!FELLOWSHIPS.includes(body.fellowship)) throw new MemberInputError('Choose a fellowship.');
    assertFellowshipAccess(context, body.fellowship);
    if (!['cell', 'bsct'].includes(body.kind)) throw new MemberInputError('Choose a cell or BSCT group.');
    if (editing && (typeof body.id !== 'string' || !memberUuid.test(body.id))) throw new MemberInputError('Choose a valid group.');
    if (body.leaderId != null && (typeof body.leaderId !== 'string' || !memberUuid.test(body.leaderId))) throw new MemberInputError('Choose a valid leader.');
    if (body.kind === 'bsct' && (typeof body.cellId !== 'string' || !memberUuid.test(body.cellId))) throw new MemberInputError('Choose a valid cell.');
    const admin = getSupabaseAdmin();
    if (!admin) throw new MemberInputError('Fellowship management requires server configuration.', 503);
    const { data, error } = body.kind === 'cell'
      ? await admin.rpc('save_fellowship_cell', { p_fellowship: body.fellowship, p_cell_id: editing ? body.id : null, p_leader_id: body.leaderId || null })
      : await admin.rpc('save_fellowship_bsct_group', { p_fellowship: body.fellowship, p_cell_id: body.cellId, p_group_id: editing ? body.id : null, p_leader_id: body.leaderId || null });
    if (error) throw error;
    return NextResponse.json(data, { status: editing ? 200 : 201 });
  } catch (error) { return memberApiFailure(error); }
}
export async function POST(request: NextRequest) { return save(request, false); }
export async function PATCH(request: NextRequest) { return save(request, true); }
