import { driveSettings } from './integration-settings';
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export function photoMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0,4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8,12)).toString() === 'WEBP') return 'image/webp';
  return null;
}
export async function driveAccess() {
  const settings = await driveSettings();
  if (!settings.clientId || !settings.clientSecret || !settings.refreshToken || !settings.folderId) throw new Error('Google Drive uploads are not connected. Ask the base administrator to complete Google Drive setup in Users & Roles.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, refresh_token: settings.refreshToken, grant_type: 'refresh_token' }) });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('Google Drive access expired. Ask the base administrator to reconnect Google Drive.');
  return { token: result.access_token as string, folderId: settings.folderId };
}
export async function uploadDrivePhoto(bytes: Uint8Array, mime: string, subject: string) {
  const { token, folderId } = await driveAccess();
  const metadata = { name: `profile-${subject.replace(/[^a-zA-Z0-9_-]/g, '-')}.${mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'}`, parents: [folderId], appProperties: { arcProfileSubject: subject } };
  const boundary = `arc-photo-${crypto.randomUUID()}`;
  const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  const result = await response.json();
  if (!response.ok || !/^[A-Za-z0-9_-]{10,200}$/.test(result.id || '')) throw new Error('The photo could not be uploaded to Google Drive. Please retry.');
  return result.id as string;
}
