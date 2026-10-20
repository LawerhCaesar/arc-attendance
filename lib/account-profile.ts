import type { SupabaseClient } from '@supabase/supabase-js';
import { hashPassword, type AuthContext } from './auth';
import { configuredUsers } from './configured-users';
import { fetchAllRows } from './pagination';
import { validateAccountEmail } from './account-email';
import { validateUsername } from './access-management';
import { DEFAULT_PERMISSIONS, validateNewPassword } from './permissions';
import { isSuperAdmin } from './super-admin';
import { validateAccountPhone } from './account-phone';

export class ProfileConflictError extends Error {}
export interface ProfileChanges { email?: unknown; username?: unknown; phone?: unknown; birthdaySmsEnabled?: unknown; newPassword?: unknown; confirmNewPassword?: unknown }

export function validateProfileChanges(changes: ProfileChanges) {
  if (changes.newPassword !== undefined && typeof changes.newPassword !== 'string') throw new Error('Enter a valid new password.');
  const newPassword = changes.newPassword ? validateNewPassword(changes.newPassword) : undefined;
  if (newPassword && changes.confirmNewPassword !== newPassword) throw new Error('The new passwords do not match.');
  if (changes.birthdaySmsEnabled !== undefined && typeof changes.birthdaySmsEnabled !== 'boolean') throw new Error('Choose a valid birthday SMS preference.');
  return { username: changes.username === undefined ? undefined : validateUsername(changes.username),
    email: changes.email === undefined ? undefined : validateAccountEmail(changes.email), newPassword,
    ...(changes.phone !== undefined ? { phone: validateAccountPhone(changes.phone) } : {}),
    ...(changes.birthdaySmsEnabled !== undefined ? { birthday_sms_enabled: changes.birthdaySmsEnabled } : {}) };
}

/** Saved profile settings override optional environment email aliases. */
export async function configuredUsersWithEmail(admin: SupabaseClient) {
  const contacts = await fetchAllRows<{ configured_username: string; email: string | null }>((from, to) => admin
    .from('staff_account_contacts').select('configured_username,email').not('configured_username', 'is', null).order('id').range(from, to));
  return configuredUsers().map(user => {
    const contact = contacts.find(item => item.configured_username === user.username.toLowerCase());
    return contact ? { ...user, email: contact.email || undefined } : user;
  });
}

export async function ownAccountProfile(admin: SupabaseClient, context: AuthContext) {
  if (context.accountId) {
    const { data, error } = await admin.from('staff_accounts').select('display_name,email,phone,birthday_sms_enabled').eq('id', context.accountId).single();
    if (error) throw error;
    return { displayName: data.display_name as string, email: data.email as string | null, phone: data.phone as string | null, birthdaySmsEnabled: data.birthday_sms_enabled !== false };
  }
  const user = (await configuredUsersWithEmail(admin)).find(item => item.username === context.username);
  if (!user) throw new Error('Account no longer exists.');
  return { displayName: user.username, email: user.email || null, phone: null, birthdaySmsEnabled: true };
}

/** Target identity comes only from the signed-in session, never request data. */
export async function saveOwnAccountEmail(admin: SupabaseClient, context: AuthContext, value: unknown) {
  const email = validateAccountEmail(value, true)!;
  let configuredOwner = context.accountId ? null : context.username.toLowerCase();
  if (context.accountId) {
    const result = await admin.from('staff_accounts').select('configured_username').eq('id', context.accountId).single();
    if (result.error) throw result.error;
    configuredOwner = result.data.configured_username;
  }
  const configured = await configuredUsersWithEmail(admin);
  const reserved = configured.find(user => (user.email === email || user.username.toLowerCase() === email) &&
    user.username.toLowerCase() !== configuredOwner);
  if (reserved) throw new Error('This email is already assigned to another account.');
  if (context.accountId) {
    const { data, error } = await admin.from('staff_accounts').update({ email }).eq('id', context.accountId)
      .select('email,session_version').single();
    if (error) throw error;
    return { email: data.email as string, sessionVersion: data.session_version as number };
  }
  const { error } = await admin.from('staff_account_contacts').upsert({
    configured_username: context.username.toLowerCase(), email, updated_at: new Date().toISOString(),
  }, { onConflict: 'configured_username' });
  if (error) throw error;
  return { email, sessionVersion: undefined };
}

/** Changes only the signed-in account; role, status and fellowship are never accepted from input. */
export async function saveOwnAccountProfile(admin: SupabaseClient, context: AuthContext, changes: ProfileChanges) {
  const fields = validateProfileChanges(changes);
  const configured = await configuredUsersWithEmail(admin);
  let source = context.configuredUsername || (context.accountId ? null : context.username.toLowerCase());
  let existing: { username: string; email: string | null; configured_username: string | null } | null = null;
  if (context.accountId) {
    const result = await admin.from('staff_accounts').select('username,email,configured_username').eq('id', context.accountId).single();
    if (result.error) throw result.error;
    existing = result.data;
    source = existing!.configured_username;
  }
  const ownConfigured = configured.find(user => user.username.toLowerCase() === source);
  const username = fields.username ?? context.username;
  const email = fields.email === undefined ? (existing ? existing.email : ownConfigured?.email ?? null) : fields.email;
  if (configuredUsers().some(user => user.username.toLowerCase() === username.toLowerCase() && user.username.toLowerCase() !== source)) {
    throw new Error('This username is already assigned to another account.');
  }
  if (email && configured.some(user => (user.email === email || user.username.toLowerCase() === email) && user.username.toLowerCase() !== source)) {
    throw new Error('This email is already assigned to another account.');
  }
  let account: { id: string; username: string; email: string | null; session_version: number; configured_username: string | null };
  if (context.accountId) {
    const record = { username, email, ...('phone' in fields ? { phone: fields.phone } : {}),
      ...('birthday_sms_enabled' in fields ? { birthday_sms_enabled: fields.birthday_sms_enabled } : {}),
      ...(fields.newPassword ? { password_hash: await hashPassword(fields.newPassword) } : {}) };
    const result = await admin.from('staff_accounts').update(record).eq('id', context.accountId)
      .eq('session_version', context.sessionVersion).eq('is_active', true)
      .select('id,username,email,session_version,configured_username').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new ProfileConflictError('Your account changed during this update. Sign in again and retry.');
    account = result.data;
  } else {
    if (!ownConfigured) throw new Error('Account no longer exists.');
    const role = await admin.from('staff_roles').select('id').eq('key', context.role).single();
    if (role.error) throw role.error;
    const password = fields.newPassword || ownConfigured.password;
    const result = await admin.from('staff_accounts').insert({
      username, email, display_name: ownConfigured.username, role_id: role.data.id, fellowship: context.fellowship || null,
      is_active: true, configured_username: ownConfigured.username.toLowerCase(),
      phone: fields.phone || null, birthday_sms_enabled: fields.birthday_sms_enabled ?? true,
      password_hash: !fields.newPassword && /^\$2[aby]\$/.test(password) ? password : await hashPassword(password),
    }).select('id,username,email,session_version,configured_username').single();
    if (result.error) throw result.error;
    account = result.data;
  }
  const updatedContext: AuthContext = { ...context, username: account.username, accountId: account.id,
    configuredUsername: account.configured_username || undefined, sessionVersion: account.session_version };
  if (isSuperAdmin(updatedContext)) updatedContext.permissions = DEFAULT_PERMISSIONS.admin;
  return { username: account.username, email: account.email, context: updatedContext };
}
