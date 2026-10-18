interface AdminIdentity { username: string; role: string; accountId?: string; configuredUsername?: string }

/** ADMIN_USERNAME identifies the base administrator, including after a profile rename. */
export function isSuperAdmin(context: AdminIdentity | null, baseUsername = process.env.ADMIN_USERNAME): boolean {
  const identity = context?.accountId ? context.configuredUsername : context?.username;
  return Boolean(context && context.role === 'admin' && baseUsername && identity &&
    identity.toLowerCase() === baseUsername.toLowerCase());
}

export function fellowshipLeaderUsername(name: string, memberId: string): string {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'leader';
  return `fl.${slug}.${memberId.replace(/-/g, '')}`;
}
