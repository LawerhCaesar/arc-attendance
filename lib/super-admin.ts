interface AdminIdentity { username: string; role: string; accountId?: string }

/** The recovery login configured as ADMIN_USERNAME is the base administrator. */
export function isSuperAdmin(context: AdminIdentity | null, baseUsername = process.env.ADMIN_USERNAME): boolean {
  return Boolean(context && context.role === 'admin' && !context.accountId && baseUsername &&
    context.username.toLowerCase() === baseUsername.toLowerCase());
}

export function fellowshipLeaderUsername(name: string, memberId: string): string {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'leader';
  return `fl.${slug}.${memberId.replace(/-/g, '')}`;
}
