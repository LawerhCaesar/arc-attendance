import { NextResponse } from 'next/server';
import { getAuthContext } from './auth';
import { canAccess } from './permissions';
import { MemberInputError, memberFellowshipScope } from './member-scope';

export async function requireMemberAccess() {
  const context = await getAuthContext();
  if (!context) throw new MemberInputError('Your session has ended. Sign in again to save your changes.', 401);
  if (!canAccess(context, 'members')) throw new MemberInputError('Your role does not have Member Roster access.', 403);
  memberFellowshipScope(context);
  return context;
}

export function memberApiFailure(error: unknown) {
  if (error instanceof MemberInputError) return NextResponse.json({ error: error.message }, { status: error.status });
  if ((error as { code?: string })?.code === '23505') {
    const message = (error as { message?: string }).message || '';
    return NextResponse.json({ error: message.includes('phone number is already used')
      ? 'This phone number is already used by another active member. Use a different number or review the existing record.'
      : 'A record with these details already exists. Refresh and try again.',
    }, { status: 409 });
  }
  if ((error as { code?: string })?.code === 'P0001') return NextResponse.json({ error: (error as { message: string }).message }, { status: 400 });
  console.error('Member management failed:', error);
  return NextResponse.json({ error: 'Unable to save or load member data. Check that the fellowship structure migration is applied.' }, { status: 500 });
}
