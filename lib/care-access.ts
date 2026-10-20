import type { AuthContext } from './auth';
import { canAccess } from './permissions';
import { memberFellowshipScope } from './member-scope';

export function hasFellowshipCare(context: AuthContext | null): boolean {
  if (context?.role !== 'fellowship_leader' || !canAccess(context, 'members')) return false;
  try { return Boolean(memberFellowshipScope(context)); } catch { return false; }
}

export function canReadCare(context: AuthContext | null): boolean {
  return context?.role === 'fellowship_leader' ? hasFellowshipCare(context) : canAccess(context, 'overview', 'care');
}

export function canAssignCare(context: AuthContext | null): boolean {
  return context?.role === 'fellowship_leader' ? hasFellowshipCare(context) : canAccess(context, 'overview');
}
