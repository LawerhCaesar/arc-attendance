/** Store one canonical address for sign-in, uniqueness and reminder delivery. */
export function validateAccountEmail(value: unknown, required = false): string | null {
  if (value == null || value === '') {
    if (required) throw new Error('Enter an email address for this fellowship leader.');
    return null;
  }
  if (typeof value !== 'string') throw new Error('Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (!email && !required) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.split('@')[0].length > 64) {
    throw new Error('Enter a valid email address.');
  }
  return email;
}

export function loginLookup(identifier: string): { field: 'email' | 'username'; value: string } {
  const value = identifier.trim().toLowerCase();
  return { field: value.includes('@') ? 'email' : 'username', value };
}
