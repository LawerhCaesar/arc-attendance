import { requireMemberAccess } from './member-api';
import { MemberInputError, memberFellowshipScope } from './member-scope';
import { getSupabaseAdmin } from './supabase-admin';
import { getAuthContext } from './auth';
import { canAccess } from './permissions';
import { FELLOWSHIPS } from './fellowships';

export async function requireFellowshipLeader() {
  const context = await requireMemberAccess();
  if (context.role !== 'fellowship_leader') throw new MemberInputError('Fellowship leader access required.', 403);
  const fellowship = memberFellowshipScope(context)!;
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Fellowship service unavailable.');
  return { admin, fellowship };
}

export async function requireFellowshipAttendanceAccess(requestedFellowship: string | null) {
  const context = await getAuthContext();
  if (!context) throw new MemberInputError('Sign in to view fellowship attendance.', 401);
  let fellowship: string;
  if (context.role === 'fellowship_leader') {
    if (!canAccess(context, 'members')) throw new MemberInputError('Fellowship roster access required.', 403);
    fellowship = memberFellowshipScope(context)!;
  } else {
    if (!canAccess(context, 'fellowship-services')) throw new MemberInputError('Fellowship reporting access required.', 403);
    if (!requestedFellowship || !FELLOWSHIPS.includes(requestedFellowship)) throw new MemberInputError('Select a valid fellowship.');
    fellowship = requestedFellowship;
  }
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Fellowship service unavailable.');
  return { admin, fellowship };
}
