import { BUILTIN_ROLES, type BuiltinRole } from './permissions';

export interface ConfiguredUser { username: string; password: string; role: BuiltinRole; fellowship?: string }

// Existing environment accounts remain available as a recovery path and cannot
// be shadowed by a database account with the same username.
export function configuredUsers(): ConfiguredUser[] {
  const users: ConfiguredUser[] = [];
  if (process.env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.APP_USERS_JSON);
      if (Array.isArray(parsed)) parsed.forEach((user: ConfiguredUser) => {
        if (typeof user.username === 'string' && typeof user.password === 'string' && BUILTIN_ROLES.includes(user.role)) users.push(user);
      });
    } catch { console.error('APP_USERS_JSON is not valid JSON'); }
  }
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (username && password && !users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
    const role = process.env.ADMIN_ROLE as BuiltinRole;
    users.push({ username, password, role: BUILTIN_ROLES.includes(role) ? role : 'admin' });
  }
  return users;
}
