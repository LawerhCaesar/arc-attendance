import { configuredAuthContext, verifyPassword, type AuthContext } from './auth';
import { configuredUsers } from './configured-users';
import { loginLookup } from './account-email';
import { getSupabaseAdmin } from './supabase-admin';
import { isSuperAdmin } from './super-admin';
import { configuredUsersWithEmail } from './account-profile';

export async function authenticateStaffLogin(identifier: string, password: string): Promise<AuthContext | null> {
  const { field, value } = loginLookup(identifier);
  const admin = getSupabaseAdmin();
  const users = field === 'email' && admin ? await configuredUsersWithEmail(admin) : configuredUsers();
  const configuredMatches = users.filter(user => user.username.toLowerCase() === value || (field === 'email' && user.email === value));
  if (configuredMatches.length > 1) return null;
  const configured = configuredMatches[0];
  if (configured && isSuperAdmin(configured)) {
    return await verifyPassword(password, configured.password) ? configuredAuthContext(configured) : null;
  }
  if (!admin && !configured) throw new Error('Account service unavailable.');
  const result = admin ? await admin.from('staff_accounts')
    .select('id, username, password_hash, role_id, fellowship, is_active, session_version').eq(field, value).maybeSingle()
    : { data: null, error: null };
  if (result.error) throw result.error;
  const account = result.data;
  if (admin && account?.is_active && await verifyPassword(password, account.password_hash)) {
    const { data: role, error } = await admin.from('staff_roles').select('key, permissions').eq('id', account.role_id).single();
    if (error) throw error;
    return { username: account.username, role: role.key, permissions: role.permissions, fellowship: account.fellowship || undefined,
      accountId: account.id, sessionVersion: account.session_version };
  }
  if (!account && configured && await verifyPassword(password, configured.password)) return configuredAuthContext(configured);
  return null;
}
