'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DismissibleBanner from './DismissibleBanner';
import { TAB_OPTIONS, type Permission } from '@/lib/permissions';
import { roleAccountGroups, type AccessRole, type ManagedAccount, type ConfiguredAccount } from '@/lib/access-management';
import { FELLOWSHIPS } from '@/lib/fellowships';
import IntegrationSettings from './IntegrationSettings';

interface Leader { id: string; name: string; fellowship: string }
interface LeaderCredential { memberId: string; displayName: string; fellowship: string; username: string; email: string | null; password: string }
interface AccessData {
  roles: AccessRole[]; accounts: ManagedAccount[]; configuredAccounts: ConfiguredAccount[];
  currentAccountId: string | null; canManageFellowshipLeaders: boolean; canEditSystemRoles: boolean;
  canManageConfiguredAccounts: boolean; fellowshipLeaders: Leader[];
  birthdaySmsReady: boolean;
}
const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200';
const actionClass = 'rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40';
const blankAccount = { id: '', username: '', email: '', display_name: '', role_id: '', fellowship: '', is_active: true, password: '', configuredUsername: '' };

export default function AccessManagement() {
  const [data, setData] = useState<AccessData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<'account' | 'role' | null>(null);
  const [account, setAccount] = useState(blankAccount);
  const [role, setRole] = useState<{ id: string; key?: string; name: string; permissions: Permission[] }>({ id: '', name: '', permissions: [] });
  const [resetPassword, setResetPassword] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [selectedLeaders, setSelectedLeaders] = useState<string[]>([]);
  const [leaderEmails, setLeaderEmails] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<LeaderCredential[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const initialFocus = useRef<HTMLInputElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/access', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load accounts.');
      setData(result);
    } catch (caught) { setError((caught as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!editor) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal(); initialFocus.current?.focus(); document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; editorTrigger.current?.focus({ preventScroll: true }); };
  }, [editor]);

  const expandRole = (id: string) => setExpandedRoles(current => new Set([...current, id]));
  const openEditor = (kind: 'account' | 'role') => {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError(''); setNotice(''); setEditor(kind);
  };
  const addAccount = (roleId: string) => {
    setAccount({ ...blankAccount, role_id: roleId }); setResetPassword(false); openEditor('account');
  };
  const editAccount = (item: ManagedAccount, passwordOnly = false) => {
    setAccount({ ...blankAccount, ...item, email: item.email || '', fellowship: item.fellowship || '' }); setResetPassword(passwordOnly); openEditor('account');
  };
  const editConfigured = (item: ConfiguredAccount, roleId: string, passwordOnly = false) => {
    setAccount({ ...blankAccount, username: item.username, email: item.email || '', display_name: item.username, role_id: roleId,
      fellowship: item.fellowship || '', configuredUsername: item.username });
    setResetPassword(passwordOnly); openEditor('account');
  };
  const editRole = (item: AccessRole) => {
    setRole({ id: item.id, key: item.key, name: item.name, permissions: item.permissions }); openEditor('role');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const record = editor === 'role' ? role : account;
    try {
      const response = await fetch('/api/admin/access', {
        method: record.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: editor, ...record }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save changes.');
      if (editor === 'account') expandRole(result.account.role_id); else expandRole(result.role.id);
      setEditor(null); setAccount(blankAccount);
      setNotice(editor === 'role' ? 'Role saved. Permissions now apply to the accounts in this role.' : 'Account saved. Changes to sign-in details, roles or account status end previous sessions.');
      if (result.sessionInvalidated) { window.location.assign('/admin/login'); return; }
      await load();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };

  const selectedRole = data?.roles.find(item => item.id === account.role_id);
  const linkedMembers = new Set(data?.accounts.map(item => item.member_id));
  const eligibleLeaders = (data?.fellowshipLeaders || []).filter(leader => !linkedMembers.has(leader.id) && FELLOWSHIPS.includes(leader.fellowship));
  const provisionLeaders = async () => {
    if (busy || !selectedLeaders.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/access/fellowship-leaders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: selectedLeaders, emails: leaderEmails }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create leader accounts.');
      setCredentials(current => [...current, ...result.credentials]); setSelectedLeaders([]);
      setNotice(`Created ${result.credentials.length} fellowship leader accounts.${result.skipped ? ` ${result.skipped} already had linked accounts.` : ''} Download the new credentials before leaving this page.`);
      await load();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };
  const downloadCredentials = () => {
    const content = [`Sign in: ${window.location.origin}/admin/login`, '', ...credentials.map(item => `${item.displayName} · ${item.fellowship}\nUsername: ${item.username}\nEmail: ${item.email || 'Add your email in My profile after sign-in'}\nPassword: ${item.password}\n`) ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fellowship-leader-credentials.txt'; link.click(); URL.revokeObjectURL(url);
  };
  const permissionLabel = (permission: string) => permission === 'users' ? 'Users & Roles' : TAB_OPTIONS.find(tab => tab.id === permission)?.label || permission;

  return <div className="space-y-5 text-gray-900">
    {data?.canManageConfiguredAccounts && <IntegrationSettings />}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-gray-950">Users &amp; Roles</h2><p className="mt-1 text-sm text-gray-600">Open a role to manage account emails, usernames, passwords and shared permissions.</p></div>
      {data && <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => addAccount(data.roles.find(item => item.key === 'welfare')?.id || '')} className={actionClass}>Add Account</button><button type="button" disabled={busy} onClick={() => { setRole({ id: '', name: '', permissions: [] }); openEditor('role'); }} className={actionClass}>Create Role</button></div>}
    </div>
    {error && !editor && <DismissibleBanner role="alert" onDismiss={() => setError('')} className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" onClick={() => { setError(''); void load(); }} className="ml-2 underline">Retry loading</button></DismissibleBanner>}
    {notice && <DismissibleBanner onDismiss={() => setNotice('')} className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{notice}</DismissibleBanner>}
    {!data ? <p className="text-sm text-gray-600">{error ? 'Accounts have not been loaded.' : 'Loading roles and accounts…'}</p> : <>
      <div className="space-y-3">{roleAccountGroups(data.roles, data.accounts, data.configuredAccounts).map(item => {
        const canManageAccounts = item.key !== 'fellowship_leader' || data.canManageFellowshipLeaders;
        const canEditRole = !item.is_system || data.canEditSystemRoles;
        return <details key={item.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" open={expandedRoles.has(item.id)} onToggle={event => {
          const open = event.currentTarget.open;
          setExpandedRoles(current => { if (current.has(item.id) === open) return current; const next = new Set(current); if (open) next.add(item.id); else next.delete(item.id); return next; });
        }}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
            <span><span className="block font-bold text-gray-950">{item.name} {item.is_system && <span className="ml-1 text-xs font-normal text-gray-500">Built-in</span>}</span><span className="mt-1 block text-xs text-gray-600">{item.permissions.map(permissionLabel).join(' · ')}</span></span>
            <span className="flex shrink-0 items-center gap-3"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{item.count} account{item.count === 1 ? '' : 's'}</span><span aria-hidden="true" className="text-lg text-gray-500 transition-transform group-open:rotate-180">⌄</span></span>
          </summary>
          <div className="space-y-4 border-t border-gray-100 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-gray-900">Accounts in {item.name}</h3><div className="flex flex-wrap gap-2">{canEditRole && <button type="button" disabled={busy} onClick={() => editRole(item)} className={actionClass}>Edit role permissions</button>}{canManageAccounts && <button type="button" disabled={busy} onClick={() => addAccount(item.id)} className={actionClass}>Add account to role</button>}</div></div>
            {!canManageAccounts && <p className="text-sm text-amber-900">Only the base administrator can create or manage fellowship leader accounts.</p>}
            {item.key === 'fellowship_leader' && <div className="space-y-1 rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><p>Leaders receive birthday SMS reminders for brethren in their assigned fellowship, seven days and one day before each birthday. Leaders add their SMS number and reminder preference in My profile.</p>{!data.birthdaySmsReady && <p className="font-semibold text-amber-900">SMSOnlineGH setup is pending. The base administrator can complete it above.</p>}</div>}
            {!item.count && <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">No accounts in this role yet.</p>}
            <div className="divide-y divide-gray-100">{item.accounts.map(user => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0"><p className="font-semibold text-gray-950">{user.display_name} {user.id === data.currentAccountId && <span className="text-xs text-blue-700">You</span>}</p><p className="break-all text-sm text-gray-700">@{user.username}</p><p className="break-all text-sm text-gray-700">{user.email || 'No email added'}</p><p className="mt-1 text-xs text-gray-600">{user.is_active ? 'Active' : 'Disabled'}{user.fellowship ? ` · ${user.fellowship}` : ''}</p></div>
              {canManageAccounts && (!user.isBaseAdmin || data.canManageConfiguredAccounts) && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => editAccount(user)} className={actionClass} aria-label={`Edit account for ${user.display_name}`}>Edit account</button><button type="button" disabled={busy} onClick={() => editAccount(user, true)} className={actionClass} aria-label={`Reset password for ${user.display_name}`}>Reset password</button></div>}
            </div>)}
            {item.configuredAccounts.map(user => <div key={`configured-${user.username}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0"><p className="break-all font-semibold text-gray-950">@{user.username}</p><p className="break-all text-sm text-gray-700">{user.email || 'No email added'}</p><p className="mt-1 text-xs text-gray-600">{user.isBaseAdmin ? 'Base administrator' : 'Existing configured login'}{user.fellowship ? ` · ${user.fellowship}` : ''}</p>{user.isBaseAdmin && <p className="mt-1 text-xs text-gray-600">Manage your username, email and password in My profile.</p>}</div>
              {!user.isBaseAdmin && data.canManageConfiguredAccounts && canManageAccounts && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => editConfigured(user, item.id)} className={actionClass} aria-label={`Edit account for ${user.username}`}>Edit account</button><button type="button" disabled={busy} onClick={() => editConfigured(user, item.id, true)} className={actionClass} aria-label={`Reset password for ${user.username}`}>Reset password</button></div>}
            </div>)}</div>
            {item.key === 'fellowship_leader' && data.canManageFellowshipLeaders && <details className="rounded-lg border border-blue-100 bg-blue-50/40 p-4"><summary className="cursor-pointer text-sm font-semibold text-blue-950">Create accounts from the fellowship leader roster · {eligibleLeaders.length} ready</summary>
              <p className="my-3 text-sm text-gray-700">Create logins for active brethren designated Fellowship Leader. Leaders can add their email in My profile after sign-in. You can optionally enter it here.</p>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" disabled={busy || !eligibleLeaders.length} checked={Boolean(eligibleLeaders.length) && eligibleLeaders.slice(0, 100).every(leader => selectedLeaders.includes(leader.id))} onChange={event => setSelectedLeaders(event.target.checked ? eligibleLeaders.slice(0, 100).map(leader => leader.id) : [])} />Select eligible leaders (up to 100)</label>
              <div className="my-3 max-h-72 divide-y divide-blue-100 overflow-y-auto">{data.fellowshipLeaders.map(leader => <div key={leader.id} className="space-y-2 py-3 text-sm text-gray-800"><label className="flex items-center gap-3"><input type="checkbox" disabled={busy || linkedMembers.has(leader.id) || !FELLOWSHIPS.includes(leader.fellowship)} checked={selectedLeaders.includes(leader.id)} onChange={event => setSelectedLeaders(current => event.target.checked ? [...current, leader.id].slice(0, 100) : current.filter(id => id !== leader.id))} /><span><span className="block font-semibold">{leader.name}</span><span className="text-xs text-gray-600">{leader.fellowship || 'Unassigned'} · {linkedMembers.has(leader.id) ? 'Account already linked' : FELLOWSHIPS.includes(leader.fellowship) ? 'Ready to create' : 'Assign a fellowship in Member Roster first'}</span></span></label>{selectedLeaders.includes(leader.id) && <label className="block text-xs font-medium">Email for {leader.name} (optional)<input type="email" maxLength={254} autoComplete="off" disabled={busy} value={leaderEmails[leader.id] || ''} onChange={event => setLeaderEmails(current => ({ ...current, [leader.id]: event.target.value }))} className={inputClass} /></label>}</div>)}</div>
              {!data.fellowshipLeaders.length && <p className="my-3 text-sm text-gray-600">Designate fellowship leaders in Member Roster to create their accounts here.</p>}
              <button type="button" disabled={busy || !selectedLeaders.length} onClick={provisionLeaders} className={actionClass}>{busy ? 'Saving…' : `Create ${selectedLeaders.length} Leader Accounts`}</button>
              {credentials.length > 0 && <div className="mt-4 space-y-3 rounded-lg bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Download new credentials before leaving this page and share them privately with each leader.</p><button type="button" onClick={downloadCredentials} className={actionClass}>Download {credentials.length} New Credentials</button></div>}
            </details>}
          </div>
        </details>;
      })}</div>
      <p className="text-xs text-gray-600">Role permissions apply to every account in that role. Fellowship leaders remain restricted to their assigned roster. Public Mark Attendance remains open.</p>
    </>}
    {editor && <dialog ref={dialog} aria-labelledby="access-editor-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-slate-950/50" onCancel={event => { event.preventDefault(); if (!busy) setEditor(null); }}>
      <form onSubmit={save} className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h3 id="access-editor-title" className="text-xl font-bold text-gray-950">{editor === 'account' ? resetPassword ? 'Reset password' : (account.id || account.configuredUsername ? 'Edit account' : 'Add account') : (role.id ? 'Edit role permissions' : 'Create role')}</h3><p className="mt-1 text-sm text-gray-600">{editor === 'account' ? selectedRole?.name : 'Choose the tabs available to accounts in this role.'}</p></div><button type="button" aria-label="Close account editor" disabled={busy} onClick={() => setEditor(null)} className="rounded-lg px-2 text-xl text-gray-600 hover:bg-gray-100">×</button></div>
        {error && <DismissibleBanner role="alert" onDismiss={() => setError('')} className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</DismissibleBanner>}
        <fieldset disabled={busy} className="space-y-4">
          {editor === 'account' ? <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Display name<input required maxLength={100} value={account.display_name} onChange={event => setAccount({ ...account, display_name: event.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-gray-700">Username<input ref={resetPassword ? undefined : initialFocus} required minLength={3} maxLength={64} autoComplete="off" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" value={account.username} onChange={event => setAccount({ ...account, username: event.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">Email address<input type="email" maxLength={254} autoComplete="off"  value={account.email} onChange={event => setAccount({ ...account, email: event.target.value })} className={inputClass} /><span className="mt-1 block text-xs font-normal text-gray-600">Sign in with this email or username using the same password.</span></label>
              <label className="text-sm font-medium text-gray-700">Role<select required value={account.role_id} onChange={event => setAccount({ ...account, role_id: event.target.value })} className={inputClass}><option value="">Choose role</option>{data?.roles.filter(item => item.key !== 'fellowship_leader' || data.canManageFellowshipLeaders).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="text-sm font-medium text-gray-700">{account.id || account.configuredUsername ? 'New password' : 'Password'}<input ref={resetPassword ? initialFocus : undefined} type="password" autoComplete="new-password" required={resetPassword || (!account.id && !account.configuredUsername)} minLength={12} maxLength={72} value={account.password} onChange={event => setAccount({ ...account, password: event.target.value })} className={inputClass} /><span className="mt-1 block text-xs font-normal text-gray-600">{(account.id || account.configuredUsername) && !resetPassword ? 'Leave blank to keep the current password. ' : ''}New passwords need at least 12 characters.</span></label>
              {selectedRole?.key === 'fellowship_leader' && <label className="text-sm font-medium text-gray-700">Assigned fellowship<select required value={account.fellowship} onChange={event => setAccount({ ...account, fellowship: event.target.value })} className={inputClass}><option value="">Choose fellowship</option>{FELLOWSHIPS.map(name => <option key={name}>{name}</option>)}</select></label>}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={account.is_active} onChange={event => setAccount({ ...account, is_active: event.target.checked })} />Account active</label>
            <p className="text-sm text-gray-600">Permissions inherited from this role: {selectedRole?.permissions.map(permissionLabel).join(', ')}. Use “Edit role permissions” in the accordion to change them.</p>
            {account.configuredUsername && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Saving moves this staff login into Users &amp; Roles management. Future username, password and access changes apply here.</p>}
          </> : <>
            <label className="block text-sm font-medium text-gray-700">Role name<input ref={initialFocus} required maxLength={80} value={role.name} onChange={event => setRole({ ...role, name: event.target.value })} className={inputClass} /></label>
            {role.key === 'fellowship_leader' && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Fellowship leaders have access to their assigned fellowship roster, birthdays, attendance and Care Centre.</p>}
            <fieldset><legend className="mb-3 text-sm font-semibold text-gray-900">Allowed tabs and their tools</legend><div className="grid gap-3 sm:grid-cols-2">{[...TAB_OPTIONS, ...(role.key === 'admin' ? [{ id: 'users' as const, label: 'Users & Roles', description: 'Required administrator account management access' }] : [])].map(tab => <label key={tab.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
              <input type="checkbox" className="mt-1" disabled={tab.id === 'users' || role.key === 'fellowship_leader'} checked={role.permissions.includes(tab.id)} onChange={event => setRole(current => ({ ...current, permissions: event.target.checked ? [...current.permissions, tab.id] : current.permissions.filter(permission => permission !== tab.id) }))} /><span><span className="block text-sm font-semibold text-gray-900">{tab.label}</span><span className="text-xs text-gray-600">{tab.description}</span></span>
            </label>)}</div></fieldset>
            {role.key === 'admin' && <p className="text-xs text-gray-600">Users &amp; Roles access is required. The base administrator retains full recovery access.</p>}
          </>}
        </fieldset>
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" disabled={busy} onClick={() => setEditor(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : resetPassword ? 'Reset password' : 'Save changes'}</button></div>
      </form>
    </dialog>}
  </div>;
}
