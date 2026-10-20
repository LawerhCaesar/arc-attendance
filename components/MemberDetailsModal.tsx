'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Member } from '@/lib/database';
import { FELLOWSHIPS } from '@/lib/fellowships';
import DismissibleBanner from './DismissibleBanner';
import MemberEditSignIn from './MemberEditSignIn';
import ProfilePhotoUpload from './ProfilePhotoUpload';

interface Props {
  memberId: string;
  onClose: () => void;
  onSaved: (member: Member) => void;
}
const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100';
const designations = ['Fellowship Leader', 'Member'];

export default function MemberDetailsModal({ memberId, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [form, setForm] = useState<Member | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(''); setNeedsSignIn(false);
    try {
      const response = await fetch(`/api/members/${memberId}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setNeedsSignIn(true);
        throw new Error(result.error || 'Unable to load this member.');
      }
      if (controller.signal.aborted) return;
      const member = result.member as Member;
      setForm({ ...member, name: member.name || '', phone: member.phone || '', location: member.location || '', birthday: member.birthday || '', fellowship: member.fellowship || 'Unassigned', designation: member.designation || 'Member' });
      setScope(result.fellowshipScope);
      setLoading(false);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load this member.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [memberId]);

  useEffect(() => {
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void load();
    return () => { request.current?.abort(); document.body.style.overflow = previousOverflow; };
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setNeedsSignIn(true);
        throw new Error(result.error || 'Unable to save these details. Your edits are still here.');
      }
      onSaved(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save these details. Your edits are still here.'); }
    finally { setSaving(false); }
  };

  return <dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-slate-950/50" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div><h3 id={titleId} className="text-xl font-bold text-gray-950">Edit member details</h3><p className="mt-1 text-sm text-gray-600">{form?.name || 'Loading member…'} · Updates are saved to Member Roster.</p></div>
        <button type="button" aria-label="Close member editor" disabled={saving} onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-gray-600 hover:bg-gray-100 disabled:opacity-50">×</button>
      </div>
      {error && <DismissibleBanner role="alert" onDismiss={() => setError('')} className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</DismissibleBanner>}
      {needsSignIn && <MemberEditSignIn onSignedIn={() => { setNeedsSignIn(false); setError(''); if (!form) void load(); }} />}
      {loading ? <p role="status" className="py-8 text-center text-sm text-gray-600">Loading member details…</p> : !form ? <button type="button" onClick={load} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Retry loading</button> : <form onSubmit={save}>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Full name<input required autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={inputClass} /></label>
          <label className="text-sm font-medium text-gray-700">Phone<input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className={inputClass} placeholder="Phone number" /></label>
          <label className="text-sm font-medium text-gray-700">Birthday (DD-MM)<input value={form.birthday} onChange={event => setForm({ ...form, birthday: event.target.value })} className={inputClass} placeholder="e.g. 15-04" /></label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Location<input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} className={inputClass} placeholder="Location / area" /></label>
          <label className="text-sm font-medium text-gray-700">Fellowship<select required disabled={Boolean(scope)} value={form.fellowship} onChange={event => setForm({ ...form, fellowship: event.target.value, cell_id: null, bsct_group_id: null })} className={inputClass}>
            <option value="Unassigned">Unassigned</option>
            {!FELLOWSHIPS.includes(form.fellowship) && form.fellowship !== 'Unassigned' && <option>{form.fellowship}</option>}
            {FELLOWSHIPS.map(name => <option key={name}>{name}</option>)}
          </select></label>
          <label className="text-sm font-medium text-gray-700">Designation<select required value={form.designation} onChange={event => setForm({ ...form, designation: event.target.value })} className={inputClass}>
            {!designations.includes(form.designation) && <option>{form.designation}</option>}
            {designations.map(name => <option key={name}>{name}</option>)}
          </select></label>
        </fieldset>
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving || needsSignIn} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>}
      {form && !loading && <div className="mt-5"><ProfilePhotoUpload name={form.name} memberId={memberId} /></div>}
    </div>
  </dialog>;
}
