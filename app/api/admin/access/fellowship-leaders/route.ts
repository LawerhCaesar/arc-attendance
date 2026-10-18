import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthContext, hashPassword } from '@/lib/auth';
import { configuredUsers } from '@/lib/configured-users';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isSuperAdmin, fellowshipLeaderUsername } from '@/lib/super-admin';
import { memberUuid } from '@/lib/member-scope';
import { FELLOWSHIPS } from '@/lib/fellowships';

export async function POST(request: NextRequest) {
  const context = await getAuthContext();
  if (!isSuperAdmin(context)) return NextResponse.json({ error: 'Only the base administrator can create fellowship leader accounts.' }, { status: context ? 403 : 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-site changes are not allowed.' }, { status: 403 });
  try {
    const body = await request.json();
    if (!Array.isArray(body.memberIds) || !body.memberIds.length || body.memberIds.length > 100 ||
      body.memberIds.some((id: unknown) => typeof id !== 'string' || !memberUuid.test(id))) {
      return NextResponse.json({ error: 'Select between 1 and 100 fellowship leaders.' }, { status: 400 });
    }
    const memberIds = Array.from(new Set<string>(body.memberIds));
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Account management requires server configuration.' }, { status: 503 });
    const { data: leaders, error: leaderError } = await admin.from('members').select('id, name, fellowship')
      .in('id', memberIds).eq('is_active', true).eq('designation', 'Fellowship Leader');
    if (leaderError) throw leaderError;
    if (leaders.length !== memberIds.length || leaders.some(leader => !FELLOWSHIPS.includes(leader.fellowship))) {
      return NextResponse.json({ error: 'Every selected member must be an active Fellowship Leader with an assigned fellowship. Refresh and check the roster.' }, { status: 409 });
    }
    const { data: role, error: roleError } = await admin.from('staff_roles').select('id').eq('key', 'fellowship_leader').single();
    if (roleError) throw roleError;
    const { data: existing, error: existingError } = await admin.from('staff_accounts').select('member_id').in('member_id', memberIds);
    if (existingError) throw existingError;
    const existingIds = new Set(existing.map(account => account.member_id));
    const configuredNames = new Set(configuredUsers().map(account => account.username.toLowerCase()));
    const credentials = leaders.filter(leader => !existingIds.has(leader.id)).map(leader => ({
      memberId: leader.id, displayName: leader.name, fellowship: leader.fellowship,
      username: fellowshipLeaderUsername(leader.name, leader.id), password: randomBytes(18).toString('base64url'),
    }));
    if (credentials.some(account => configuredNames.has(account.username))) {
      return NextResponse.json({ error: 'A generated username is reserved by an environment account. Create that account manually with another username.' }, { status: 409 });
    }
    if (!credentials.length) return NextResponse.json({ credentials: [], skipped: existingIds.size });
    const records = [];
    for (const account of credentials) records.push({
      username: account.username, display_name: account.displayName, fellowship: account.fellowship,
      member_id: account.memberId, role_id: role.id, is_active: true, password_hash: await hashPassword(account.password),
    });
    // Concurrent requests cannot reset an existing account's password.
    const { data: created, error } = await admin.from('staff_accounts')
      .upsert(records, { onConflict: 'member_id', ignoreDuplicates: true }).select('member_id');
    if (error) throw error;
    const createdIds = new Set(created.map(account => account.member_id));
    return NextResponse.json({ credentials: credentials.filter(account => createdIds.has(account.memberId)), skipped: memberIds.length - createdIds.size },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Fellowship account provisioning failed:', (error as { code?: string }).code || 'unknown');
    return NextResponse.json({ error: 'Account setup failed. Refresh Users & Roles to check existing accounts before retrying.' }, { status: 503 });
  }
}
