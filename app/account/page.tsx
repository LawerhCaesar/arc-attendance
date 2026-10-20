'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import DismissibleBanner from '@/components/DismissibleBanner';
import UpcomingFellowshipBirthdays from '@/components/UpcomingFellowshipBirthdays';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';

interface Profile { displayName: string; username: string; email: string | null; phone: string | null; birthdaySmsEnabled: boolean; role: string; fellowship?: string; dashboardUrl: string; birthdaySmsReady: boolean }

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdaySmsEnabled, setBirthdaySmsEnabled] = useState(true);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    void fetch('/api/account/profile', { cache: 'no-store' }).then(async response => {
      if (response.status === 401) { router.replace('/admin/login'); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load your account.');
      setProfile(result); setEmail(result.email || ''); setUsername(result.username);
      setPhone(result.phone || ''); setBirthdaySmsEnabled(result.birthdaySmsEnabled !== false);
    }).catch(caught => setError((caught as Error).message));
  }, [router]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, username, phone, birthdaySmsEnabled, password, newPassword, confirmNewPassword }),
      });
      const result = await response.json();
      if (response.status === 401) { router.replace('/admin/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Could not save your profile.');
      setEmail(result.email || ''); setUsername(result.username); setPassword(''); setNewPassword(''); setConfirmNewPassword(''); setNotice(result.message);
      setPhone(result.phone || ''); setBirthdaySmsEnabled(result.birthdaySmsEnabled !== false);
      setProfile(current => current ? { ...current, username: result.username, email: result.email, phone: result.phone, birthdaySmsEnabled: result.birthdaySmsEnabled } : current);
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };
  const receivesReminders = profile?.role === 'admin' || profile?.role === 'fellowship_leader';
  return <div className="min-h-dvh bg-slate-50 text-gray-900">
    <Navbar />
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <Link href={profile?.dashboardUrl || '/admin'} className="text-sm font-semibold text-blue-800 hover:underline">← Back to workspace</Link>
      <div><h1 className="mt-4 text-3xl font-bold text-gray-950">My profile</h1><p className="mt-2 text-sm text-gray-600">Manage your username, email address and password.</p></div>
      {error && <DismissibleBanner role="alert" onDismiss={() => setError('')} className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</DismissibleBanner>}
      {notice && <DismissibleBanner role="status" onDismiss={() => setNotice('')} className="rounded-xl bg-green-50 p-4 text-sm text-green-900">{notice}</DismissibleBanner>}
      {!profile ? <p className="text-sm text-gray-600">{error ? 'Account settings are unavailable.' : 'Loading your account…'}</p> : <>
        {profile.role === 'fellowship_leader' && <UpcomingFellowshipBirthdays />}
        <ProfilePhotoUpload name={profile.displayName} />
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-gray-950">{profile.displayName}</h2><p className="mt-1 text-sm text-gray-600">@{profile.username}{profile.fellowship ? ` · ${profile.fellowship}` : ''}</p>
          <form onSubmit={save} className="mt-5 space-y-5">
            <label className="block text-sm font-semibold text-gray-800">Username<input type="text" required minLength={3} maxLength={64} autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,63}" value={username} onChange={event => setUsername(event.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500" /><span className="mt-2 block text-xs font-normal text-gray-600">3–64 letters, numbers, dots, underscores or hyphens.</span></label>
            <label className="block text-sm font-semibold text-gray-800">Email address<input type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500" /><span className="mt-2 block text-xs font-normal text-gray-600">Sign in with this email or your username using the same password.</span></label>
            <label className="block text-sm font-semibold text-gray-800">Phone number for SMS<input type="tel" maxLength={32} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={busy} placeholder="e.g. 0241234567 or +233241234567" className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>
            {receivesReminders && <label className="flex items-center gap-3 text-sm text-gray-800"><input type="checkbox" checked={birthdaySmsEnabled} onChange={event => setBirthdaySmsEnabled(event.target.checked)} disabled={busy} className="h-4 w-4" />Receive birthday SMS reminders</label>}
            <fieldset disabled={busy} className="space-y-4 rounded-xl border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-900">Change password</legend>
              <p className="text-xs text-gray-600">Leave these fields blank to keep your current password. New passwords need at least 12 characters.</p>
              <label className="block text-sm font-semibold text-gray-800">New password<input type="password" minLength={12} maxLength={72} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>
              <label className="block text-sm font-semibold text-gray-800">Confirm new password<input type="password" required={Boolean(newPassword)} minLength={12} maxLength={72} autoComplete="new-password" value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>
            </fieldset>
            <label className="block text-sm font-semibold text-gray-800">Current password<input type="password" required maxLength={256} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500" /><span className="mt-2 block text-xs font-normal text-gray-600">Confirm your current password to save changes. Changes to your sign-in details sign out your other sessions.</span></label>
            <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Saving…' : 'Save profile'}</button>
          </form>
        </section>
        {receivesReminders && <section className="space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><h2 className="font-bold">Birthday SMS reminders</h2><p>{profile.role === 'admin' ? 'You receive reminders for brethren across all fellowships.' : `You receive reminders for brethren in ${profile.fellowship || 'your assigned fellowship'}.`} Reminders are scheduled seven days and one day before each birthday.</p><p>{!profile.birthdaySmsEnabled ? 'Your birthday SMS reminders are turned off.' : !profile.phone ? 'Add your phone number above to receive SMS reminders.' : profile.birthdaySmsReady ? 'Your number is saved and SMS reminders are enabled.' : 'Your number is saved. Reminders will begin once the base administrator completes SMSOnlineGH setup.'}</p></section>}
      </>}
    </main>
  </div>;
}
