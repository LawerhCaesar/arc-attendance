import { FELLOWSHIPS, matchFellowship } from './fellowships';
import type { Member } from './database';

interface ScopeContext { role: string; fellowship?: string }

export class MemberInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Never accept a request parameter as the scope of a fellowship leader. */
export function memberFellowshipScope(context: ScopeContext | null): string | undefined {
  if (context?.role !== 'fellowship_leader') return undefined;
  if (!context.fellowship || !FELLOWSHIPS.includes(context.fellowship)) {
    throw new MemberInputError('No valid fellowship is assigned to this account. Contact your administrator.', 403);
  }
  return context.fellowship;
}

export function assertFellowshipAccess(context: ScopeContext | null, fellowship: string): void {
  const scope = memberFellowshipScope(context);
  if (scope && fellowship !== scope) throw new MemberInputError('You can only manage brethren in your assigned fellowship.', 403);
}

export const memberUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMemberInput(body: Record<string, unknown>, context: ScopeContext | null): Pick<Member, 'name' | 'phone' | 'fellowship' | 'designation' | 'birthday' | 'location' | 'cell_id' | 'bsct_group_id'> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MemberInputError('Enter valid member details.');
  const text = (field: string) => {
    if (body[field] == null) return '';
    if (typeof body[field] !== 'string') throw new MemberInputError(`Enter a valid ${field}.`);
    return body[field].trim();
  };
  const name = text('name');
  const requestedFellowship = text('fellowship');
  const designation = text('designation');
  if (!name || !requestedFellowship || !designation) throw new MemberInputError('Name, fellowship, and designation are required.');
  assertFellowshipAccess(context, requestedFellowship);
  for (const field of ['cell_id', 'bsct_group_id']) {
    if (body[field] !== undefined && body[field] !== null && (typeof body[field] !== 'string' || !memberUuid.test(body[field]))) {
      throw new MemberInputError('Select a valid cell and BSCT group, or leave the member unassigned.');
    }
  }
  return {
    name, fellowship: matchFellowship(requestedFellowship), designation,
    phone: text('phone'), birthday: text('birthday'), location: text('location'),
    ...(body.cell_id !== undefined ? { cell_id: body.cell_id as string | null } : {}),
    ...(body.bsct_group_id !== undefined ? { bsct_group_id: body.bsct_group_id as string | null } : {}),
  };
}
