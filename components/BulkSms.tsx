'use client';

import { useCallback, useEffect, useState } from 'react';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { smsMessageInfo, type BulkSmsCampaign, type BulkSmsRecipient } from '@/lib/bulk-sms';
import type { SmsBalance } from '@/lib/bulk-sms-provider';

type Preview = BulkSmsCampaign & { recipients?: BulkSmsRecipient[] };
interface Workspace { configured: boolean; sender: string; history: BulkSmsCampaign[]; audiences: { fellowship: string | null; recipients: number; missingPhone: number; duplicatePhone: number }[] }
const statusLabel = (campaign: BulkSmsCampaign) => ({ draft: 'Draft', ready: 'Partly submitted', sending: 'Sending / awaiting confirmation', completed: 'Submission complete', uncertain: 'Needs review' })[campaign.status];
const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100';

export default function BulkSms() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [fellowship, setFellowship] = useState('all');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [balanceBusy, setBalanceBusy] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/bulk-sms', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Bulk SMS could not be loaded.');
    setWorkspace(result);
  }, []);
  useEffect(() => { void load().catch(error => setError(error.message)); }, [load]);
  const checkBalance = async () => {
    setBalanceBusy(true); setBalanceError('');
    try {
      const response = await fetch('/api/admin/bulk-sms/balance', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setBalance(result);
    } catch (error) { setBalanceError(error instanceof Error ? error.message : 'Balance unavailable.'); }
    finally { setBalanceBusy(false); }
  };
  const compose = () => { setPreview(null); setNotice(''); setError(''); };
  const audience = workspace?.audiences.find(item => item.fellowship === (fellowship === 'all' ? null : fellowship));
  const info = smsMessageInfo(message.trim());
  const createPreview = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setPreview(null);
    try {
      const response = await fetch('/api/admin/bulk-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', id: crypto.randomUUID(), fellowship: fellowship === 'all' ? null : fellowship, message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
    } catch (error) { setError(error instanceof Error ? error.message : 'Preview could not be prepared.'); }
    finally { setBusy(false); }
  };
  const send = async (id: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      let result: Preview;
      do {
        const response = await fetch('/api/admin/bulk-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', id }) });
        result = await response.json();
        if (!response.ok) throw new Error((result as unknown as { error: string }).error);
        setPreview(result);
      } while (result.status === 'ready');
      setNotice(`${result.accepted} accepted by SMSOnlineGH · ${result.rejected} rejected · ${result.uncertain} uncertain · ${result.skipped} skipped.`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Sending was interrupted. Refresh history before trying again.'); }
    finally { setBusy(false); await load().catch(error => setError(error.message)); }
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-gray-950">Bulk SMS</h2><p className="mt-1 text-sm text-gray-600">Send a message to one fellowship or the entire church.</p></div>
      <button type="button" disabled={busy} onClick={() => { setError(''); void load().catch(error => setError(error.message)); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Refresh history</button>
    </div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{notice}</div>}
    {workspace && !workspace.configured && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">SMS setup is pending. The base administrator can save the SMSOnlineGH API key and approved sender in Users &amp; Roles. You can prepare a preview while setup is pending.</div>}
    <section aria-label="SMS credits" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div><h3 className="font-semibold text-gray-950">SMS credits</h3><p className="mt-1 text-sm text-gray-600">{balance ? `${balance.balance.toLocaleString()} ${balance.model === 'quantity' ? 'credits remaining' : balance.currency || 'account balance'}` : 'Check your balance before sending.'}</p>{balanceError && <p role="alert" className="mt-2 text-sm text-red-700">{balanceError}</p>}</div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={balanceBusy || !workspace?.configured} onClick={() => { void checkBalance(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">{balanceBusy ? 'Checking…' : 'Check balance'}</button><a href="https://portal.smsonlinegh.com/auth/login" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Buy SMS credits ↗</a></div>
      <p className="w-full text-xs text-gray-500">Purchases open SMSOnlineGH in a new tab. After topping up the account connected to this app, check your balance again.</p>
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={event => { void createPreview(event); }} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-gray-950">Compose message</h3>
        <label className="block text-sm font-semibold text-gray-800">Send to<select value={fellowship} disabled={busy} onChange={event => { setFellowship(event.target.value); compose(); }} className={`${inputClass} mt-2`}><option value="all">Entire church</option>{FELLOWSHIPS.map(name => <option key={name}>{name}</option>)}</select></label>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-lg font-bold text-gray-950">{audience ? audience.recipients.toLocaleString() : '—'} phone numbers</p><p className="mt-1 text-xs leading-5 text-gray-600">Active brethren only. Archived and merged records are excluded. Shared phone numbers receive one message.{audience ? ` ${audience.missingPhone} missing or invalid contacts; ${audience.duplicatePhone} repeated contacts excluded.` : ''}</p></div>
        <label className="block text-sm font-semibold text-gray-800">Message<textarea required rows={8} maxLength={1600} value={message} disabled={busy} onChange={event => { setMessage(event.target.value); compose(); }} placeholder="Write your church announcement…" className={`${inputClass} mt-2 resize-y font-normal`} /></label>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600"><span>{message.length}/1,600 characters · {info.encoding}</span><span>{info.segments} SMS {info.segments === 1 ? 'part' : 'parts'} per number</span></div>
        <p className="text-sm text-gray-600">Sender: <strong className="text-gray-950">{workspace?.sender || 'CEYC ARC'}</strong></p>
        <button disabled={busy || !workspace || !message.trim() || !audience?.recipients} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Processing…' : 'Preview message'}</button>
      </form>
      <section aria-label="Message preview" className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 sm:p-6">
        <h3 className="text-lg font-bold text-gray-950">Review before sending</h3>
        {preview ? <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-blue-800">{preview.sender}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-900">{preview.message}</p></div>
          <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-gray-600">Audience</dt><dd className="mt-1 font-semibold text-gray-950">{preview.fellowship || 'Entire church'}</dd></div><div><dt className="text-gray-600">Recipients</dt><dd className="mt-1 font-semibold text-gray-950">{preview.recipient_count} unique numbers</dd></div><div><dt className="text-gray-600">Estimated SMS parts</dt><dd className="mt-1 font-semibold text-gray-950">{preview.recipient_count * preview.segments}</dd></div><div><dt className="text-gray-600">Status</dt><dd className="mt-1 font-semibold text-gray-950">{statusLabel(preview)}</dd></div></dl>
          <p className="text-xs leading-5 text-gray-600">{preview.segments} {preview.segments === 1 ? 'part' : 'parts'} per recipient. Final charges depend on your provider plan and destinations. Provider acceptance does not confirm handset delivery.</p>
          {preview.recipients && <details className="rounded-xl border border-blue-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-blue-900">View recipient list</summary><ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">{preview.recipients.map(recipient => <li key={recipient.phone} className="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-2"><span>{recipient.name} <span className="text-gray-500">· {recipient.fellowship}</span></span><span className="font-mono text-gray-700">{recipient.phone}</span></li>)}</ul></details>}
          {preview.status === 'draft' && <><p className="text-sm text-gray-700">Sending will use your SMSOnlineGH credits. Preview expires after 15 minutes.</p><button type="button" disabled={busy || !workspace?.configured} onClick={() => { void send(preview.id); }} className="w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Sending…' : `Send to ${preview.recipient_count} numbers`}</button></>}
          {['sending','uncertain'].includes(preview.status) && <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-950">Check SMSOnlineGH before creating another message. An interrupted or uncertain submission is never automatically sent again.</p>}
        </div> : <div className="mt-8 rounded-2xl border border-dashed border-blue-200 bg-white/70 p-8 text-center"><p className="font-semibold text-gray-800">Your message preview will appear here</p><p className="mt-2 text-sm leading-6 text-gray-600">Choose your recipients, write the message, then preview the exact text and recipient count.</p></div>}
      </section>
    </div>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6" aria-label="SMS history">
      <h3 className="text-lg font-bold text-gray-950">Recent messages</h3><p className="mt-1 text-sm text-gray-600">Latest 30 messages and previews. Accepted means submitted to SMSOnlineGH.</p>
      {!workspace ? <p role="status" className="mt-5 text-sm text-gray-600">Loading SMS history…</p> : !workspace.history.length ? <p className="mt-5 text-sm text-gray-500">No bulk messages yet.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-gray-500"><th className="px-2 py-3">Message / audience</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Results</th><th className="px-2 py-3">Administrator</th></tr></thead><tbody className="divide-y divide-gray-100">{workspace.history.map(campaign => <tr key={campaign.id}>
        <td className="min-w-64 max-w-sm px-2 py-4"><p className="font-semibold text-gray-950">{campaign.fellowship || 'Entire church'} · {campaign.recipient_count} numbers</p><p className="mt-1 line-clamp-2 break-words text-gray-700">{campaign.message}</p><p className="mt-2 text-xs text-gray-500">{new Date(campaign.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Accra' })}</p></td>
        <td className="min-w-40 px-2 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${['uncertain','sending'].includes(campaign.status) ? 'bg-amber-100 text-amber-900' : campaign.status === 'completed' ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-700'}`}>{statusLabel(campaign)}</span>{campaign.status === 'ready' && <button type="button" disabled={busy || !workspace.configured} onClick={() => { void send(campaign.id); }} className="mt-3 block rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">Continue remaining {campaign.recipient_count - campaign.next_offset}</button>}{['sending','uncertain'].includes(campaign.status) && <p className="mt-2 max-w-52 text-xs text-amber-900">Review in SMSOnlineGH before sending again.</p>}</td>
        <td className="min-w-40 px-2 py-4 text-xs leading-6 text-gray-700">{campaign.accepted} accepted<br />{campaign.rejected} rejected · {campaign.uncertain} uncertain<br />{campaign.skipped} skipped</td><td className="px-2 py-4 text-xs text-gray-600">{campaign.sent_by || campaign.created_by}</td>
      </tr>)}</tbody></table></div>}
    </section>
  </div>;
}
