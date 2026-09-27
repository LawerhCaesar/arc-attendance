import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContext, hashPassword } from '@/lib/auth';
import { configuredUsers } from '@/lib/configured-users';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { canAccess, validateNewPassword, validateRolePermissions } from '@/lib/permissions';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { fetchAllRows } from '@/lib/pagination';

export const dynamic = 'force-dynamic';
const accountFields = 'id, username, display_name, role_id, fellowship, is_active, created_at, updated_at';
const roleFields = 'id, key, name, permissions, is_system';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === '23505') return NextResponse.json({ error: 'That username or role name already exists.' }, { status: 409 });
  if (code === 'P0001') return NextResponse.json({ error: 'This change would remove the last managed administrator or alter a protected role.' }, { status: 409 });
  if (code === '23503') return NextResponse.json({ error: 'The selected role no longer exists. Refresh and try again.' }, { status: 409 });
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: 'Account management is unavailable. Check that the user-role migration has been applied.' }, { status: 503 });
}

export async function GET() {
  const context = await getAuthContext();
  if (!canAccess(context, 'users')) return NextResponse.json({ error: 'Administrator access required' }, { status: context ? 403 : 401 });
  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Account management requires server configuration.');
    const [accounts, roles] = await Promise.all([
      fetchAllRows((from, to) => admin.from('staff_accounts').select(accountFields).order('username').order('id').range(from, to)),
      fetchAllRows((from, to) => admin.from('staff_roles').select(roleFields).order('name').order('id').range(from, to)),
    ]);
    return NextResponse.json({ accounts, roles, currentAccountId: context?.accountId || null,
      configuredAccounts: configuredUsers().map(({ username, role }) => ({ username, role })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

async function save(request: NextRequest, editing: boolean) {
  const context = await getAuthContext();
  if (!canAccess(context, 'users')) return NextResponse.json({ error: 'Administrator access required' }, { status: context ? 403 : 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-site changes are not allowed' }, { status: 403 });
  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Account management requires server configuration.');
    const body = await request.json();
    if (editing && (typeof body.id !== 'string' || !uuid.test(body.id))) throw new Error('Select a valid account or role.');
    if (body.kind === 'role') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) throw new Error('Enter a role name of 1–80 characters.');
      const permissions = validateRolePermissions(body.permissions);
      if (editing) {
        const { data: existing, error } = await admin.from('staff_roles').select('id, is_system').eq('id', body.id).maybeSingle();
        if (error) throw error;
        if (!existing || existing.is_system) throw new Error('Built-in roles are protected. Create a custom role instead.');
      }
      const record = { name: body.name.trim(), permissions };
      const query = editing ? admin.from('staff_roles').update(record).eq('id', body.id) : admin.from('staff_roles').insert({ ...record, key: `custom_${randomUUID()}`, is_system: false });
      const { data, error } = await query.select(roleFields).single();
      if (error) throw error;
      return NextResponse.json({ role: data }, { status: editing ? 200 : 201 });
    }
    if (body.kind !== 'account') throw new Error('Choose an account or role action.');
    if (typeof body.display_name !== 'string' || !body.display_name.trim() || body.display_name.trim().length > 100) throw new Error('Enter a display name of 1–100 characters.');
    if (typeof body.role_id !== 'string' || !uuid.test(body.role_id) || typeof body.is_active !== 'boolean') throw new Error('Select a role and account status.');
    const { data: role, error: roleError } = await admin.from('staff_roles').select('id, key').eq('id', body.role_id).maybeSingle();
    if (roleError) throw roleError;
    if (!role) throw new Error('Select an existing role.');
    const fellowship = role.key === 'fellowship_leader' ? body.fellowship : null;
    if (role.key === 'fellowship_leader' && !FELLOWSHIPS.includes(fellowship)) throw new Error('Choose the fellowship this leader can access.');
    const record: Record<string, unknown> = { display_name: body.display_name.trim(), role_id: role.id, is_active: body.is_active, fellowship };
    if (editing) {
      if (context?.accountId === body.id && (!body.is_active || role.key !== 'admin')) throw new Error('You cannot remove your own administrator access.');
      const { data: existing, error } = await admin.from('staff_accounts').select('id').eq('id', body.id).maybeSingle();
      if (error) throw error;
      if (!existing) throw new Error('Account not found.');
    } else {
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error('Username must be 3–64 letters, numbers, dots, underscores or hyphens.');
      if (configuredUsers().some(user => user.username.toLowerCase() === username)) throw new Error('This username belongs to an existing environment account. Choose another username.');
      record.username = username;
    }
    if (!editing || (typeof body.password === 'string' && body.password.length)) record.password_hash = await hashPassword(validateNewPassword(body.password));
    const query = editing ? admin.from('staff_accounts').update(record).eq('id', body.id) : admin.from('staff_accounts').insert(record);
    const { data, error } = await query.select(accountFields).single();
    if (error) throw error;
    return NextResponse.json({ account: data }, { status: editing ? 200 : 201 });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) { return save(request, false); }
export async function PATCH(request: NextRequest) { return save(request, true); }
