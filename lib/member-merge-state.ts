interface MergeMemberState {
  id: string;
  is_active: boolean;
  merged_into_id?: string | null;
}

/** A retry is successful only when every selected secondary now belongs to the
 * same surviving primary. Missing/deactivated/unrelated records require review.
 */
export function evaluateMemberMerge(
  members: MergeMemberState[], memberIds: string[], primaryId: string,
): { state: 'complete' | 'pending' | 'stale'; secondaryIds: string[] } {
  const byId = new Map(members.map(member => [member.id, member]));
  if (!memberIds.includes(primaryId) || !byId.get(primaryId)?.is_active) {
    return { state: 'stale', secondaryIds: [] };
  }
  const secondaryIds: string[] = [];
  for (const id of new Set(memberIds)) {
    if (id === primaryId) continue;
    const member = byId.get(id);
    if (!member || (!member.is_active && member.merged_into_id !== primaryId)) {
      return { state: 'stale', secondaryIds: [] };
    }
    if (member.is_active) secondaryIds.push(id);
  }
  return { state: secondaryIds.length ? 'pending' : 'complete', secondaryIds };
}
