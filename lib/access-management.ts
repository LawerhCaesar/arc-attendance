import { ALL_PERMISSIONS, validateRolePermissions, type Permission } from './permissions';

export interface AccessRole { id: string; key: string; name: string; permissions: Permission[]; is_system: boolean }
export interface ManagedAccount {
  id: string; username: string; email?: string | null; display_name: string; role_id: string;
  fellowship: string | null; member_id?: string | null; configured_username?: string | null; is_active: boolean; isBaseAdmin?: boolean;
}
export interface ConfiguredAccount { username: string; email?: string; role: string; fellowship?: string; isBaseAdmin: boolean }

export function roleAccountGroups(roles: AccessRole[], accounts: ManagedAccount[], configured: ConfiguredAccount[]) {
  return roles.map(role => ({
    ...role,
    accounts: accounts.filter(account => account.role_id === role.id).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    configuredAccounts: configured.filter(account => account.role === role.key),
    count: accounts.filter(account => account.role_id === role.id).length + configured.filter(account => account.role === role.key).length,
  }));
}

export function validateUsername(value: unknown): string {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error('Username must be 3–64 letters, numbers, dots, underscores or hyphens.');
  return username;
}

export function validateEditableRolePermissions(value: unknown, key?: string): Permission[] {
  if (key === 'admin') {
    if (!Array.isArray(value) || !value.includes('users') || value.some(item => !ALL_PERMISSIONS.includes(item))) {
      throw new Error('The administrator role must retain Users & Roles access. Choose valid tabs.');
    }
    return [...new Set(value)] as Permission[];
  }
  const permissions = validateRolePermissions(value);
  if (key === 'fellowship_leader' && (permissions.length !== 1 || permissions[0] !== 'members')) {
    throw new Error('Fellowship leaders must retain access to their assigned fellowship roster only.');
  }
  return permissions;
}
