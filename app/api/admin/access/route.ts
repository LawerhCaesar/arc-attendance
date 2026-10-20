import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContext, hashPassword } from '@/lib/auth';
import { configuredUsers } from '@/lib/configured-users';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { canAccess, validateNewPassword } from '@/lib/permissions';
import { validateEditableRolePermissions, validateUsername, type AccessRole, type ManagedAccount } from '@/lib/access-management';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { fetchAllRows } from '@/lib/pagination';
import { isSuperAdmin } from '@/lib/super-admin';
import { validateAccountEmail } from '@/lib/account-email';
import { configuredUsersWithEmail } from '@/lib/account-profile';
import { smsSettings } from '@/lib/integration-settings';

export const dynamic = 'force-dynamic';
const accountFields = 'id, username, email, display_name, role_id, fellowship, member_id, configured_username, is_active, created_at, updated_at';
const roleFields = 'id, key, name, permissions, is_system';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === '23505') return NextResponse.json({ error: 'That username, email, configured login or role name is already in use. Choose a different value.' }, { status: 409 });
  if (code === 'P0001') return NextResponse.json({ error: (error as { message?: string }).message || 'This change would remove the last administrator or alter a protected role.' }, { status: 409 });
  if (code === '23503') return NextResponse.json({ error: 'The selected role no longer exists. Refresh and try again.' }, { status: 409 });
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: 'Account management is unavailable. Apply the role-account management migration and check server configuration.' }, { status: 503 });
}
const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });

export async function GET() {
  const context = await getAuthContext();
  if (!canAccess(context, 'users')) return NextResponse.json({ error: 'Administrator access required' }, { status: context ? 403 : 401 });
  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Account management requires server configuration.');
    const [accounts, roles, fellowshipLeaders, configured] = await Promise.all([
      fetchAllRows<ManagedAccount>((from, to) => admin.from('staff_accounts').select(accountFields).order('username').order('id').range(from, to)),
      fetchAllRows<AccessRole>((from, to) => admin.from('staff_roles').select(roleFields).order('name').order('id').range(from, to)),
      isSuperAdmin(context) ? fetchAllRows((from, to) => admin.from('members').select('id, name, fellowship')
        .eq('is_active', true).eq('designation', 'Fellowship Leader').order('fellowship').order('name').order('id').range(from, to)) : [],
      configuredUsersWithEmail(admin),
    ]);
    const sms = await smsSettings();
    const overridden = new Set(accounts.map(account => account.configured_username));
    return NextResponse.json({ accounts: accounts.map(account => ({ ...account, isBaseAdmin: isSuperAdmin({
      username: account.username, accountId: account.id, configuredUsername: account.configured_username || undefined,
      role: roles.find(role => role.id === account.role_id)?.key || '',
    }) })), roles, fellowshipLeaders, birthdaySmsReady: Boolean(sms.apiKey && sms.sender),
      canManageFellowshipLeaders: isSuperAdmin(context), canEditSystemRoles: isSuperAdmin(context), canManageConfiguredAccounts: isSuperAdmin(context),
      currentAccountId: context?.accountId || null,
      configuredAccounts: configured.filter(user => !overridden.has(user.username.toLowerCase()))
        .map(user => ({ username: user.username, email: user.email, role: user.role, fellowship: user.fellowship, isBaseAdmin: isSuperAdmin(user) })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

async function save(request: NextRequest, editing: boolean) {
  const context = await getAuthContext();
  if (!canAccess(context, 'users')) return NextResponse.json({ error: 'Administrator access required' }, { status: context ? 403 : 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return forbidden('Cross-site changes are not allowed');
  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Account management requires server configuration.');
    const body = await request.json();
    if (editing && (typeof body.id !== 'string' || !uuid.test(body.id))) throw new Error('Select a valid account or role.');
    if (body.kind === 'role') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) throw new Error('Enter a role name of 1–80 characters.');
      let existing: AccessRole | null = null;
      if (editing) {
        const result = await admin.from('staff_roles').select(roleFields).eq('id', body.id).maybeSingle();
        if (result.error) throw result.error;
        existing = result.data;
        if (!existing) throw new Error('Role not found.');
        if (existing.is_system && !isSuperAdmin(context)) return forbidden('Only the base administrator can edit built-in roles.');
      }
      const permissions = validateEditableRolePermissions(body.permissions, existing?.key);
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
    if (role.key === 'fellowship_leader' && !isSuperAdmin(context)) return forbidden('Only the base administrator can create or manage fellowship leader accounts.');
    const fellowship = role.key === 'fellowship_leader' ? body.fellowship : null;
    if (role.key === 'fellowship_leader' && !FELLOWSHIPS.includes(fellowship)) throw new Error('Choose the fellowship this leader can access.');

    let existing: ManagedAccount | null = null;
    if (editing) {
      const result = await admin.from('staff_accounts').select(accountFields).eq('id', body.id).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
      if (!existing) throw new Error('Account not found.');
      const previousRole = await admin.from('staff_roles').select('key').eq('id', existing.role_id).single();
      if (previousRole.error) throw previousRole.error;
      if (isSuperAdmin({ username: existing.username, accountId: existing.id,
        configuredUsername: existing.configured_username || undefined, role: previousRole.data.key }) && !isSuperAdmin(context)) {
        return forbidden('Only the base administrator can change the base administrator account.');
      }
      if (previousRole.data.key === 'fellowship_leader' && !isSuperAdmin(context)) return forbidden('Only the base administrator can create or manage fellowship leader accounts.');
      if (context?.accountId === body.id && (!body.is_active || role.key !== 'admin')) throw new Error('You cannot remove your own administrator access.');
    }
    const configured = await configuredUsersWithEmail(admin);
    const source = !editing && typeof body.configuredUsername === 'string'
      ? configured.find(user => user.username.toLowerCase() === body.configuredUsername.toLowerCase()) : undefined;
    if (body.configuredUsername && !source) throw new Error('Configured account not found. Refresh and try again.');
    if (source && (!isSuperAdmin(context) || isSuperAdmin(source))) return forbidden('Only the base administrator can manage configured staff logins. Use My profile to change your own base administrator credentials.');

    // Legacy clients may omit username on an edit; preserve it in that case.
    const username = validateUsername(body.username ?? existing?.username);
    const reserved = configuredUsers().find(user => user.username.toLowerCase() === username);
    const sourceUsername = source?.username.toLowerCase() || existing?.configured_username;
    if (reserved && reserved.username.toLowerCase() !== sourceUsername) throw new Error('This username belongs to an existing configured account. Choose another username.');
    const email = validateAccountEmail(body.email === undefined ? existing?.email ?? source?.email : body.email);
    const reservedEmail = email && configured.find(user => user.email === email || user.username.toLowerCase() === email);
    if (reservedEmail && reservedEmail.username.toLowerCase() !== sourceUsername) throw new Error('This email belongs to an existing configured account. Choose another email.');
    const record: Record<string, unknown> = { username, email, display_name: body.display_name.trim(), role_id: role.id, is_active: body.is_active, fellowship };
    if (source) record.configured_username = source.username.toLowerCase();
    if (typeof body.password === 'string' && body.password.length) record.password_hash = await hashPassword(validateNewPassword(body.password));
    else if (!editing) {
      if (!source) throw new Error('Enter a password for the new account.');
      record.password_hash = /^\$2[aby]\$/.test(source.password) ? source.password : await hashPassword(source.password);
    }
    const query = editing ? admin.from('staff_accounts').update(record).eq('id', body.id) : admin.from('staff_accounts').insert(record);
    const { data, error } = await query.select(accountFields).single();
    if (error) throw error;
    const sessionInvalidated = (context?.accountId === data.id && (existing?.username !== username || existing?.email !== email || Boolean(record.password_hash))) ||
      Boolean(source && context?.username.toLowerCase() === source.username.toLowerCase());
    return NextResponse.json({ account: data, sessionInvalidated }, { status: editing ? 200 : 201 });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) { return save(request, false); }
export async function PATCH(request: NextRequest) { return save(request, true); }
