import { NextResponse } from 'next/server';
import { getAuthContext } from './auth';
import { canAccess } from './permissions';
import { MemberInputError, memberFellowshipScope } from './member-scope';
import { getSupabaseAdmin } from './supabase-admin';
import { fetchAllRows } from './pagination';
import { normalizeDuplicatePhone } from './member-duplicates';

interface ConflictDetails { phones?: string[]; excludeId?: string; memberId?: string; candidates?: { name: string; phone: string }[] }

export async function requireMemberAccess() {
  const context = await getAuthContext();
  if (!context) throw new MemberInputError('Your session has ended. Sign in again to save your changes.', 401);
  if (!canAccess(context, 'members')) throw new MemberInputError('Your role does not have Member Roster access.', 403);
  memberFellowshipScope(context);
  return context;
}

export async function memberApiFailure(error: unknown, conflict: ConflictDetails = {}) {
  if (error instanceof MemberInputError) return NextResponse.json({ error: error.message }, { status: error.status });
  if ((error as { code?: string })?.code === '23505') {
    const message = (error as { message?: string }).message || '';
    if (!message.includes('phone number is already used')) return NextResponse.json({ error: 'A record with these details already exists. Refresh and try again.' }, { status: 409 });
    let names: string[] = [];
    try {
      const context = await getAuthContext();
      const admin = getSupabaseAdmin();
      if (admin && canAccess(context, 'members', 'entry', 'past-entry')) {
        const scope = memberFellowshipScope(context);
        const phones = [...(conflict.phones || [])];
        if (conflict.memberId) {
          let query = admin.from('members').select('phone').eq('id', conflict.memberId);
          if (scope) query = query.eq('fellowship', scope);
          const { data, error } = await query.maybeSingle();
          if (error) throw error;
          if (data?.phone) phones.push(data.phone);
        }
        const keys = new Set(phones.map(normalizeDuplicatePhone).filter(Boolean));
        if (keys.size) {
          let query = admin.from('members').select('id,name,phone').eq('is_active', true).order('id');
          if (scope) query = query.eq('fellowship', scope);
          const members = await fetchAllRows<{ id: string; name: string; phone: string }>((from, to) => query.range(from, to));
          names = members.filter(member => member.id !== conflict.excludeId && keys.has(normalizeDuplicatePhone(member.phone))).map(member => member.name);
          const candidates = conflict.candidates || [];
          names.push(...candidates.filter(candidate => {
            const key = normalizeDuplicatePhone(candidate.phone);
            return key && candidates.filter(other => normalizeDuplicatePhone(other.phone) === key).length > 1;
          }).map(candidate => candidate.name));
        }
      }
    } catch { /* A conflict remains blocked if the permitted owner lookup fails. */ }
    names = [...new Set(names)].sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ error: names.length
      ? `This phone number is already used by ${names.join(', ')}. Use a different number or review the existing record.`
      : 'This phone number is already used by another active member. Ask an administrator to review the existing record.',
      ...(names.length ? { conflictingNames: names } : {}),
    }, { status: 409 });
  }
  if ((error as { code?: string })?.code === 'P0001') return NextResponse.json({ error: (error as { message: string }).message }, { status: 400 });
  console.error('Member management failed:', error);
  return NextResponse.json({ error: 'Unable to save or load member data. Check that the fellowship structure migration is applied.' }, { status: 500 });
}
