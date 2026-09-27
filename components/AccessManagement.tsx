'use client';

import { useCallback, useEffect, useState } from 'react';
import { TAB_OPTIONS, type Permission } from '@/lib/permissions';
import { FELLOWSHIPS } from '@/lib/fellowships';

interface Role { id: string; key: string; name: string; permissions: Permission[]; is_system: boolean }
interface Account { id: string; username: string; display_name: string; role_id: string; fellowship: string | null; is_active: boolean }
interface AccessData { roles: Role[]; accounts: Account[]; configuredAccounts: { username: string; role: string }[]; currentAccountId: string | null }
const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const blankAccount = { id: '', username: '', display_name: '', role_id: '', fellowship: '', is_active: true, password: '' };

export default function AccessManagement() {
  const [data, setData] = useState<AccessData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<'account' | 'role' | null>(null);
  const [account, setAccount] = useState(blankAccount);
  const [role, setRole] = useState<{ id: string; name: string; permissions: Permission[] }>({ id: '', name: '', permissions: [] });

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/access', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load accounts.');
      setData(result);
    } catch (error) { setError((error as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const record = editor === 'role' ? role : account;
    try {
      const response = await fetch('/api/admin/access', {
        method: record.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: editor, ...record }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save changes.');
      setEditor(null); setAccount(blankAccount);
      setNotice(editor === 'role' ? 'Role saved. Updated tab access applies immediately.' : 'Account saved. Share new credentials privately. Password resets, deactivation and role changes end previous sessions.');
      await load();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };

  const selectedRole = data?.roles.find(item => item.id === account.role_id);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Users &amp; Roles</h2>
        <p className="mt-1 text-sm text-gray-600">Create staff accounts and choose the tabs each role can use. Only administrators can manage accounts and roles.</p>
        <p className="mt-2 text-sm text-amber-800">Public Mark Attendance remains open to everyone. Role permissions protect staff tabs and their tools; they do not make the public check-in page private.</p>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error} <button onClick={() => { setError(''); load(); }} className="ml-2 underline">Retry loading</button></div>}
      {notice && <div role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{notice}</div>}
      {!data ? <p className="text-sm text-gray-600">{error ? 'Accounts have not been loaded.' : 'Loading accounts and roles…'}</p> : <>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => { setAccount({ ...blankAccount, role_id: data.roles.find(item => item.key === 'welfare')?.id || '' }); setEditor('account'); setError(''); setNotice(''); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Account</button>
          <button type="button" disabled={busy} onClick={() => { setRole({ id: '', name: '', permissions: [] }); setEditor('role'); setError(''); setNotice(''); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create Role</button>
        </div>
        {editor && <form onSubmit={save} className="space-y-4 rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">{editor === 'account' ? (account.id ? 'Edit Account / Reset Password' : 'Add Account') : (role.id ? 'Edit Role' : 'Create Role')}</h3>
          {editor === 'account' ? <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-700">Display name<input required maxLength={100} value={account.display_name} onChange={event => setAccount({ ...account, display_name: event.target.value })} className={inputClass} /></label>
              <label className="text-sm text-gray-700">Username<input required disabled={Boolean(account.id)} minLength={3} maxLength={64} autoComplete="off" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" value={account.username} onChange={event => setAccount({ ...account, username: event.target.value })} className={inputClass} /></label>
              <label className="text-sm text-gray-700">Role<select required value={account.role_id} onChange={event => setAccount({ ...account, role_id: event.target.value })} className={inputClass}><option value="">Choose role</option>{data.roles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="text-sm text-gray-700">{account.id ? 'New password (leave blank to keep current)' : 'Password'}<input type="password" autoComplete="new-password" required={!account.id} minLength={12} maxLength={72} value={account.password} onChange={event => setAccount({ ...account, password: event.target.value })} className={inputClass} /><span className="mt-1 block text-xs text-gray-500">At least 12 characters. Passwords are never displayed after saving.</span></label>
              {selectedRole?.key === 'fellowship_leader' && <label className="text-sm text-gray-700">Assigned fellowship<select required value={account.fellowship} onChange={event => setAccount({ ...account, fellowship: event.target.value })} className={inputClass}><option value="">Choose fellowship</option>{FELLOWSHIPS.map(name => <option key={name}>{name}</option>)}</select></label>}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={account.is_active} onChange={event => setAccount({ ...account, is_active: event.target.checked })} />Account active (uncheck to revoke sign-in)</label>
            {selectedRole && <p className="text-sm text-gray-600">Tab access: {selectedRole.permissions.map(permission => permission === 'users' ? 'Users & Roles' : TAB_OPTIONS.find(tab => tab.id === permission)?.label).join(', ')}.</p>}
            {selectedRole?.key === 'admin' && <p className="text-sm font-semibold text-amber-800">Administrator grants all tabs, account management, and administrative data tools.</p>}
          </> : <>
            <label className="block text-sm text-gray-700">Role name<input required maxLength={80} value={role.name} onChange={event => setRole({ ...role, name: event.target.value })} placeholder="e.g. Fellowship Reports Team" className={inputClass} /></label>
            <fieldset><legend className="mb-3 text-sm font-semibold text-gray-900">Allowed tabs and their tools</legend>
              <div className="grid gap-3 sm:grid-cols-2">{TAB_OPTIONS.map(tab => <label key={tab.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input type="checkbox" className="mt-1" checked={role.permissions.includes(tab.id)} onChange={event => setRole(previous => ({ ...previous, permissions: event.target.checked ? [...previous.permissions, tab.id] : previous.permissions.filter(permission => permission !== tab.id) }))} />
                <span><span className="block text-sm font-semibold text-gray-800">{tab.label}</span><span className="text-xs text-gray-500">{tab.description}</span></span>
              </label>)}</div>
            </fieldset>
          </>}
          <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} onClick={() => { setEditor(null); setAccount(blankAccount); setError(''); }} className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700">Cancel</button></div>
        </form>}
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="mb-3 text-lg font-bold text-gray-900">Staff Accounts ({data.accounts.length})</h3>
          {!data.accounts.length && <p className="text-sm text-gray-500">No managed accounts yet. Use Add Account to create the first one.</p>}
          <div className="divide-y divide-gray-100">{data.accounts.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-semibold text-gray-900">{item.display_name} <span className="text-xs font-normal text-gray-500">@{item.username}{item.id === data.currentAccountId ? ' · You' : ''}</span></p><p className="text-sm text-gray-600">{data.roles.find(role => role.id === item.role_id)?.name} · {item.is_active ? 'Active' : 'Disabled'}{item.fellowship ? ` · ${item.fellowship}` : ''}</p></div>
            <button disabled={busy} onClick={() => { setAccount({ ...item, fellowship: item.fellowship || '', password: '' }); setEditor('account'); setError(''); setNotice(''); }} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">Edit Account</button>
          </div>)}</div>
          <h4 className="mb-2 mt-5 text-sm font-semibold text-gray-800">Existing environment accounts</h4>
          <p className="mb-2 text-xs text-gray-500">These existing logins are kept unchanged as a recovery path. Manage their credentials in the hosting configuration; new accounts are managed here.</p>
          {data.configuredAccounts.map(item => <p key={item.username} className="text-sm text-gray-600">{item.username} · {item.role} · Environment-managed</p>)}
        </section>
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="mb-3 text-lg font-bold text-gray-900">Roles ({data.roles.length})</h3>
          <div className="divide-y divide-gray-100">{data.roles.map(item => <div key={item.id} className="flex items-start justify-between gap-4 py-3">
            <div><p className="font-semibold text-gray-900">{item.name}{item.is_system && <span className="ml-2 text-xs font-normal text-gray-500">Built-in</span>}</p><p className="mt-1 text-xs text-gray-500">{item.permissions.map(permission => permission === 'users' ? 'Users & Roles' : TAB_OPTIONS.find(tab => tab.id === permission)?.label).join(' · ')}</p></div>
            {!item.is_system && <button disabled={busy} onClick={() => { setRole({ id: item.id, name: item.name, permissions: item.permissions }); setEditor('role'); setError(''); setNotice(''); }} className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">Edit Role</button>}
          </div>)}</div>
        </section>
      </>}
    </div>
  );
}
