import { MemberInputError, assertFellowshipAccess, memberUuid } from './member-scope';
import { FELLOWSHIPS } from './fellowships';

interface ScopeContext { role: string; fellowship?: string }
function scopedBody(value: unknown, context: ScopeContext) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MemberInputError('Choose valid fellowship groups.');
  const body = value as Record<string, unknown>;
  if (typeof body.fellowship !== 'string' || !FELLOWSHIPS.includes(body.fellowship)) throw new MemberInputError('Choose a fellowship.');
  assertFellowshipAccess(context, body.fellowship);
  return body;
}
function uuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !memberUuid.test(value)) throw new MemberInputError(`Choose a valid ${label}.`);
  return value;
}
export function parseStructureAssignment(value: unknown, context: ScopeContext) {
  const body = scopedBody(value, context);
  if (!Array.isArray(body.memberIds) || !body.memberIds.length || body.memberIds.length > 1000) throw new MemberInputError('Select between 1 and 1000 brethren.');
  return {
    p_fellowship: body.fellowship as string,
    p_member_ids: [...new Set(body.memberIds.map(id => uuid(id, 'roster member')))],
    p_cell_id: uuid(body.cellId, 'cell'),
    p_bsct_group_id: body.bsctGroupId == null ? null : uuid(body.bsctGroupId, 'BSCT group'),
  };
}
export function parseStructureDeletion(value: unknown, context: ScopeContext) {
  const body = scopedBody(value, context);
  if (body.kind !== 'cell' && body.kind !== 'bsct') throw new MemberInputError('Choose a cell or BSCT group.');
  return { p_fellowship: body.fellowship as string, p_kind: body.kind, p_id: uuid(body.id, 'group') };
}
