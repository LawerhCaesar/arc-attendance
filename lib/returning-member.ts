import type { Member } from './database';
import { normalizeDuplicatePhone } from './member-duplicates';
import { MemberInputError } from './member-scope';

const nameKey = (value: string) => value.trim().toLowerCase().split(/\s+/).sort().join(' ');
/** A returning archived member needs a full name match, with no conflicting
 * known phone. A shared phone alone must never restore the wrong person.
 */
export function returningArchivedMember(person: Pick<Member, 'name' | 'phone' | 'fellowship'>, candidates: Member[]): Member | null {
  const phone = normalizeDuplicatePhone(person.phone);
  const matches = candidates.filter(member => member.is_active === false && !member.merged_into_id &&
    nameKey(member.name) === nameKey(person.name) &&
    (person.fellowship ? member.fellowship === person.fellowship : Boolean(phone)) &&
    (!phone || !normalizeDuplicatePhone(member.phone) || normalizeDuplicatePhone(member.phone) === phone));
  if (matches.length > 1) throw new MemberInputError('More than one archived member matches these details. Ask an administrator to review the records before recording attendance.', 409);
  return matches[0] || null;
}
