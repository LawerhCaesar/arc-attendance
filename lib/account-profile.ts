import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from './auth';
import { configuredUsers } from './configured-users';
import { fetchAllRows } from './pagination';
import { validateAccountEmail } from './account-email';

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
    const { data, error } = await admin.from('staff_accounts').select('display_name,email').eq('id', context.accountId).single();
    if (error) throw error;
    return { displayName: data.display_name as string, email: data.email as string | null };
  }
  const user = (await configuredUsersWithEmail(admin)).find(item => item.username === context.username);
  if (!user) throw new Error('Account no longer exists.');
  return { displayName: user.username, email: user.email || null };
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
