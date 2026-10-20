import type { AuthContext } from './auth';
import { canAccess } from './permissions';
import { memberFellowshipScope, memberUuid, MemberInputError } from './member-scope';
import { getSupabaseAdmin } from './supabase-admin';

export function accountPhotoSubject(context: AuthContext): string {
  const configured = context.configuredUsername || (!context.accountId ? context.username.toLowerCase() : null);
  return configured ? `configured:${configured}` : `account:${context.accountId}`;
}
export async function photoSubject(context: AuthContext, memberId: string | null) {
  if (!memberId) return accountPhotoSubject(context);
  if (!canAccess(context,'members')) throw new MemberInputError('Member Roster access required.',403);
  if (!memberUuid.test(memberId)) throw new MemberInputError('Select a valid member.');
  const admin = getSupabaseAdmin(); if (!admin) throw new Error('Photo service is unavailable.');
  let query = admin.from('members').select('id').eq('id',memberId).is('merged_into_id',null);
  const scope = memberFellowshipScope(context);
  if (scope) query=query.eq('fellowship',scope);
  const {data,error}=await query.maybeSingle();
  if (error) throw new Error('Member access could not be checked.');
  if (!data) throw new MemberInputError('Member not found in your roster.',404);
  return `member:${memberId}`;
}
