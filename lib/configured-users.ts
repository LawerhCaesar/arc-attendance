import { BUILTIN_ROLES, type BuiltinRole } from './permissions';
import { validateAccountEmail } from './account-email';

export interface ConfiguredUser { username: string; password: string; role: BuiltinRole; fellowship?: string; email?: string }

// Existing environment accounts remain available as a recovery path and cannot
// be shadowed by a database account with the same username.
export function configuredUsers(): ConfiguredUser[] {
  const users: ConfiguredUser[] = [];
  if (process.env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.APP_USERS_JSON);
      if (Array.isArray(parsed)) parsed.forEach((user: ConfiguredUser) => {
        if (typeof user.username === 'string' && typeof user.password === 'string' && BUILTIN_ROLES.includes(user.role)) {
          let email: string | undefined;
          try { email = validateAccountEmail(user.email) || undefined; } catch { /* Keep username recovery when an optional address is invalid. */ }
          users.push({ ...user, email });
        }
      });
    } catch { console.error('APP_USERS_JSON is not valid JSON'); }
  }
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (username && password && !users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
    const role = process.env.ADMIN_ROLE as BuiltinRole;
    let email: string | undefined;
    try { email = validateAccountEmail(process.env.ADMIN_EMAIL) || undefined; } catch { /* Username recovery remains available. */ }
    users.push({ username, password, role: BUILTIN_ROLES.includes(role) ? role : 'admin', email });
  }
  return users;
}
