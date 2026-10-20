import { requireMemberAccess } from './member-api';
import { MemberInputError, memberFellowshipScope } from './member-scope';
import { getSupabaseAdmin } from './supabase-admin';

export async function requireFellowshipLeader() {
  const context = await requireMemberAccess();
  if (context.role !== 'fellowship_leader') throw new MemberInputError('Fellowship leader access required.', 403);
  const fellowship = memberFellowshipScope(context)!;
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Fellowship service unavailable.');
  return { admin, fellowship };
}
