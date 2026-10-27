import type { SupabaseClient } from '@supabase/supabase-js';
import type { Member } from './database';
import { fetchAllRows } from './pagination';
import { FELLOWSHIPS } from './fellowships';
import { MemberInputError, memberUuid } from './member-scope';

export type UnassignedMember = Pick<Member, 'name' | 'phone' | 'location' | 'designation'> & { id: string };

export async function listUnassignedMembers(admin: SupabaseClient) {
  return fetchAllRows<UnassignedMember>((from, to) => admin.from('members')
    .select('id,name,phone,location,designation').eq('fellowship', 'Unassigned')
    .eq('is_active', true).is('merged_into_id', null).order('name').order('id').range(from, to));
}

/** The destination comes from the authenticated leader, never the request body.
 * One conditional update also makes concurrent claims mutually exclusive.
 */
export async function assignUnassignedMember(admin: SupabaseClient, id: unknown, fellowship: string) {
  if (typeof id !== 'string' || !memberUuid.test(id)) throw new MemberInputError('Select a valid unassigned member.');
  if (!FELLOWSHIPS.includes(fellowship)) throw new MemberInputError('A valid assigned fellowship is required.', 403);
  const { data, error } = await admin.from('members')
    .update({ fellowship, cell_id: null, bsct_group_id: null, updated_at: new Date().toISOString() })
    .eq('id', id).eq('fellowship', 'Unassigned').eq('is_active', true).is('merged_into_id', null)
    .select('*').maybeSingle<Member>();
  if (error) throw error;
  if (!data) throw new MemberInputError('This member is no longer available in Unassigned. Refresh the list and try again.', 409);
  return data;
}
