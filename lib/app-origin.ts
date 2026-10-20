/** Use one valid application origin for setup links and both OAuth steps. */
export function appOrigin(requestOrigin: string, configuredUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl.trim());
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.origin;
    } catch { /* A malformed deployment setting must not disable integrations. */ }
  }
  return new URL(requestOrigin).origin;
}
