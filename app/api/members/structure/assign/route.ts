import { NextRequest, NextResponse } from 'next/server';
import { requireMemberAccess, memberApiFailure } from '@/lib/member-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { MemberInputError } from '@/lib/member-scope';
import { parseStructureAssignment } from '@/lib/structure-actions';

export async function POST(request: NextRequest) {
  try {
    const context = await requireMemberAccess();
    const input = parseStructureAssignment(await request.json().catch(() => null), context);
    const admin = getSupabaseAdmin();
    if (!admin) throw new MemberInputError('Fellowship management requires server configuration.', 503);
    const { data, error } = await admin.rpc('assign_fellowship_members', input);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return memberApiFailure(error); }
}
