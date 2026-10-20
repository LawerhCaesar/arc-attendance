import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from './supabase-admin';

export interface SmsSettings { apiKey?: string; sender?: string }
export interface DriveSettings { clientId?: string; clientSecret?: string; refreshToken?: string; folderId?: string }
export type IntegrationProvider = 'sms_online_gh' | 'google_drive';
const key = () => {
  if (!process.env.ADMIN_SESSION_SECRET) throw new Error('Server encryption is not configured.');
  return createHash('sha256').update(`arc-integrations-v1:${process.env.ADMIN_SESSION_SECRET}`).digest();
};
export function encryptSettings(provider: string, value: object): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(provider));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}
export function decryptSettings<T>(provider: string, value: string): T {
  const [version, iv, tag, body] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Integration settings could not be opened.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(provider)); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8'));
}
export async function readIntegration<T>(provider: IntegrationProvider): Promise<T> {
  const admin = getSupabaseAdmin(); if (!admin) throw new Error('Integration settings are unavailable.');
  const { data, error } = await admin.from('app_integrations').select('encrypted_settings').eq('provider', provider).maybeSingle();
  if (error) throw new Error('Integration settings are unavailable. Apply the integration migration.');
  return data ? decryptSettings<T>(provider, data.encrypted_settings) : {} as T;
}
export async function writeIntegration(provider: IntegrationProvider, value: object, username: string) {
  const admin = getSupabaseAdmin(); if (!admin) throw new Error('Integration settings are unavailable.');
  const { error } = await admin.from('app_integrations').upsert({ provider, encrypted_settings: encryptSettings(provider, value), updated_by: username, updated_at: new Date().toISOString() }, { onConflict: 'provider' });
  if (error) throw new Error('Integration settings could not be saved.');
}
export async function smsSettings(): Promise<SmsSettings> {
  const saved = await readIntegration<SmsSettings>('sms_online_gh');
  return { apiKey: saved.apiKey || process.env.SMSONLINEGH_API_KEY, sender: saved.sender || process.env.SMSONLINEGH_SENDER };
}
export async function driveSettings(): Promise<DriveSettings> {
  const saved = await readIntegration<DriveSettings>('google_drive');
  return { clientId: saved.clientId || process.env.GOOGLE_DRIVE_CLIENT_ID, clientSecret: saved.clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: saved.refreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN, folderId: saved.folderId || process.env.GOOGLE_DRIVE_PHOTO_FOLDER_ID };
}
