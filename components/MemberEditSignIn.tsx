'use client';

import { useState } from 'react';

export default function MemberEditSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Sign-in failed. Please try again.');
      } else if (!result.permissions?.includes('members')) {
        setError('This account cannot edit the roster. Sign in with an account that has Member Roster access.');
      } else {
        setPassword('');
        onSignedIn();
      }
    } catch {
      setError('Could not connect. Your edits are still here; please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={signIn} className="mb-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm text-amber-900">Sign in again to save. Your unsaved member details are still in this window.</p>
      <label className="block text-sm text-gray-700">
        Staff username
        <input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
      </label>
      <label className="block text-sm text-gray-700">
        Password
        <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in to continue'}</button>
    </form>
  );
}
