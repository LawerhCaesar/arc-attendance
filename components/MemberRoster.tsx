'use client';
import DismissibleBanner from './DismissibleBanner';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FELLOWSHIPS, matchFellowship } from '@/lib/fellowships';
import MemberDuplicateReview from '@/components/MemberDuplicateReview';
import MemberEditSignIn from '@/components/MemberEditSignIn';
import FellowshipStructure from '@/components/FellowshipStructure';
import type { FellowshipCell, BsctGroup } from '@/lib/fellowship-structure';
import { dateInAccra } from '@/lib/birthdays';

interface Member {
  id: string;
  name: string;
  phone: string;
  fellowship: string;
  designation: string;
  birthday: string;
  location: string;
  cell_id?: string | null;
  bsct_group_id?: string | null;
}

const DESIGNATIONS = ['Fellowship Leader', 'Cell Leader', 'BSCT Leader', 'Member'] as const;

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-700',
  'Cell Leader': 'bg-blue-100 text-blue-700',
  'BSCT Leader': 'bg-amber-100 text-amber-700',
  'Member': 'bg-gray-100 text-gray-600',
};

const emptyForm = (): Omit<Member, 'id'> => ({
  name: '', phone: '', fellowship: '', designation: 'Member', birthday: '', location: '', cell_id: null, bsct_group_id: null,
});

export default function MemberRoster({ canReviewDuplicates = false, fellowshipScope, onRosterChanged }: { canReviewDuplicates?: boolean; fellowshipScope?: string; onRosterChanged?: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [cells, setCells] = useState<FellowshipCell[]>([]);
  const [bsctGroups, setBsctGroups] = useState<BsctGroup[]>([]);
  const [loadError, setLoadError] = useState('');
  const [cellFilter, setCellFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fellowshipFilter, setFellowshipFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, 'id'>>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [signInNotice, setSignInNotice] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicateReviewVersion, setDuplicateReviewVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memberRequestVersion = useRef(0);

  const fetchMembers = useCallback(async () => {
    const requestVersion = ++memberRequestVersion.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const [res, structureRes] = await Promise.all([
        fetch(showArchived ? '/api/members/archived' : '/api/members', { cache: 'no-store' }),
        fetch('/api/members/structure', { cache: 'no-store' }),
      ]);
      const result = await res.json();
      if (requestVersion !== memberRequestVersion.current) return;
      if (!res.ok) throw new Error(result.error || 'Unable to load your roster.');
      setMembers(result);
      const structure = await structureRes.json();
      if (requestVersion !== memberRequestVersion.current) return;
      if (!structureRes.ok) throw new Error(structure.error || 'Unable to load fellowship cells.');
      setCells(structure.cells);
      setBsctGroups(structure.bsctGroups);
    } catch (caught) { if (requestVersion === memberRequestVersion.current) setLoadError(caught instanceof Error ? caught.message : 'Unable to load your roster.'); }
    if (requestVersion === memberRequestVersion.current) setIsLoading(false);
  }, [showArchived]);

  useEffect(() => { setMembers([]); setCells([]); setBsctGroups([]); setCellFilter('all'); fetchMembers(); }, [fetchMembers, fellowshipScope]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch('/api/members/export', { cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Could not export members. Please try again.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `members-${dateInAccra()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export members. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const fellowships = [...FELLOWSHIPS, 'Unassigned'].sort();

  const filtered = members.filter(m => {
    const matchFellowship = fellowshipFilter === 'all' || m.fellowship === fellowshipFilter;
    const matchDesignation = designationFilter === 'all' || m.designation === designationFilter;
    const matchCell = cellFilter === 'all' || (cellFilter === 'unassigned' ? !m.cell_id : m.cell_id === cellFilter);
    const q = search.toLowerCase().trim();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.fellowship.toLowerCase().includes(q) || m.phone.includes(q);
    return matchFellowship && matchDesignation && matchSearch && matchCell;
  });

  const openAdd = () => {
    setNeedsSignIn(false);
    setSignInNotice(null);
    setEditingMember(null);
    setForm({ ...emptyForm(), fellowship: fellowshipScope || '' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    setNeedsSignIn(false);
    setSignInNotice(null);
    setEditingMember(m);
    setForm({ name: m.name, phone: m.phone, fellowship: m.fellowship, designation: m.designation, birthday: m.birthday, location: m.location, cell_id: m.cell_id || null, bsct_group_id: m.bsct_group_id || null });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.fellowship.trim() || !form.designation) {
      setFormError('Name, Fellowship, and Designation are required.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const isEdit = !!editingMember;
      const url = isEdit ? `/api/members/${editingMember!.id}` : '/api/members';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccessMsg(isEdit ? 'Member updated.' : 'Member added to roster.');
        onRosterChanged?.();
        setShowForm(false);
        await fetchMembers();
        setDuplicateReviewVersion(value => value + 1);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const d = await res.json();
        if (res.status === 401 || res.status === 403) {
          setNeedsSignIn(true);
          setSignInNotice(null);
          setFormError(res.status === 403 ? d.error : null);
        } else {
          setFormError(d.error || 'Failed to save member.');
        }
      }
    } catch { setFormError('An error occurred.'); }
    setIsSaving(false);
  };

  const handleArchive = async (id: string, restore = false) => {
    if (!restore && !confirm('Archive this member? Their details and attendance history will be kept. Cell and BSCT assignments will be cleared. They will return to the active roster when recorded present again, or you can restore them manually.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/members/${id}/archive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: restore ? 'restore' : 'archive' }),
      });
      if (res.ok) {
        setSuccessMsg(restore ? 'Member restored. Assign their cell and BSCT group from the active roster.' : 'Member archived. Their details and attendance history are preserved.');
        onRosterChanged?.();
        await fetchMembers();
        setDuplicateReviewVersion(value => value + 1);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const result = await res.json();
        setLoadError(result.error || 'Unable to change this member’s archive status.');
      }
    } catch { setLoadError('Unable to change this member’s archive status.'); }
    setDeletingId(null);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (json.length < 2) { setFormError('File must have at least a header row and one data row'); return; }

        const headers = json[0].map((h: any) => String(h).toLowerCase().trim());
        const nameIdx = headers.findIndex((h: string) => h.includes('name'));
        const phoneIdx = headers.findIndex((h: string) => h.includes('contact') || h.includes('phone'));
        const locationIdx = headers.findIndex((h: string) => h.includes('location'));
        const birthdayIdx = headers.findIndex((h: string) => h.includes('birthday') || h.includes('birth') || h.includes('dob'));
        const fellowshipIdx = headers.findIndex((h: string) => h.includes('fellowship'));
        const designationIdx = headers.findIndex((h: string) => h.includes('designation') || h.includes('role'));

        if (nameIdx === -1) {
          setFormError('File must contain a NAME column');
          return;
        }

        const imported: Omit<Member, 'id'>[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row?.length) continue;
          const name = String(row[nameIdx] || '').trim();
          if (!name) continue;

          let birthday = '';
          const bval = birthdayIdx !== -1 ? row[birthdayIdx] : undefined;
          if (bval !== undefined && bval !== null && bval !== '') {
            if (typeof bval === 'number') {
              const d = new Date(new Date(1899, 11, 30).getTime() + bval * 86400000);
              birthday = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } else {
              const s = String(bval).trim();
              const m = s.match(/(\d{1,2})[-\/](\d{1,2})/);
              if (m) birthday = `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
              else birthday = s;
            }
          }

          const designation = designationIdx !== -1 ? String(row[designationIdx] || 'Member').trim() : 'Member';

          imported.push({
            name,
            phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
            location: locationIdx !== -1 ? String(row[locationIdx] || '').trim() : '',
            birthday,
            fellowship: fellowshipScope && fellowshipIdx === -1 ? fellowshipScope : matchFellowship(fellowshipIdx !== -1 ? String(row[fellowshipIdx] || '').trim() : ''),
            designation: DESIGNATIONS.includes(designation as any) ? designation as any : 'Member',
          });
        }

        if (imported.length === 0) { setFormError('No valid entries found'); return; }
        
        setIsLoading(true);
        fetch('/api/members/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ members: imported }),
        })
        .then(async res => {
          if (res.ok) {
            setSuccessMsg(`Imported and saved ${imported.length} members to roster.`);
            onRosterChanged?.();
            fetchMembers();
            setDuplicateReviewVersion(value => value + 1);
            setTimeout(() => setSuccessMsg(null), 5000);
          } else {
            const result = await res.json().catch(() => ({}));
            setLoadError(result.error || 'Unable to confirm the import. Refresh the roster before retrying.');
            setIsLoading(false);
          }
        })
        .catch(() => {
          setLoadError('Unable to confirm the import. Refresh the roster before retrying.');
          setIsLoading(false);
        });
      } catch {
        setFormError('Error parsing Excel file.');
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {fellowshipScope && <p className="rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">{fellowshipScope} Fellowship · Manage your brethren, cells and BSCT groups</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white p-1" aria-label="Roster status">
          <button type="button" aria-pressed={!showArchived} onClick={() => { if (!showArchived) return; setMembers([]); setShowArchived(false); setCellFilter('all'); }} className={`rounded-md px-4 py-2 text-sm font-semibold ${!showArchived ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>Active brethren</button>
          <button type="button" aria-pressed={showArchived} onClick={() => { if (showArchived) return; setMembers([]); setShowArchived(true); setCellFilter('all'); }} className={`rounded-md px-4 py-2 text-sm font-semibold ${showArchived ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>Archived brethren</button>
        </div>
        {showArchived && <p className="text-sm text-gray-600">Details and attendance are kept. Brethren return automatically when recorded present, or you can restore them here.</p>}
      </div>
      {loadError && <DismissibleBanner role="alert" onDismiss={() => setLoadError('')} className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError} <button type="button" onClick={fetchMembers} className="ml-2 underline">Retry</button></DismissibleBanner>}
      {/* Success banner */}
      {successMsg && (
        <DismissibleBanner onDismiss={() => setSuccessMsg(null)} className="p-3 bg-green-100 text-green-800 rounded-xl text-sm font-medium">{successMsg}</DismissibleBanner>
      )}

      {!showArchived && canReviewDuplicates && <MemberDuplicateReview onRosterChanged={fetchMembers} refreshKey={duplicateReviewVersion} />}
      {!showArchived && !loadError && <FellowshipStructure members={members} cells={cells} bsctGroups={bsctGroups} fellowshipScope={fellowshipScope} loading={isLoading} onChanged={fetchMembers} onEditMember={id => { const member = members.find(member => member.id === id); if (member) openEdit(member); }} />}

      {!showArchived && <section aria-labelledby="member-export-heading" className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 id="member-export-heading" className="font-semibold text-gray-900">Export Member Data</h3>
            <p className="mt-1 text-sm text-gray-600">Download all active members you can access, including their contact details, fellowship, designation, birthday and location. Search and filters do not limit the export.</p>
            <p className="mt-1 text-xs text-gray-600">Ghana phone numbers are exported as nine digits: 0503700378, 233503700378 and +233503700378 → 503700378. Spaces, dashes and brackets are removed. Unrecognized numbers are preserved with a review note. Stored records are unchanged. Removed and merged-away records are excluded.</p>
          </div>
          <button type="button" onClick={handleExport} disabled={isExporting} className="shrink-0 rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
            {isExporting ? 'Preparing export…' : 'Export All Members (.xlsx)'}
          </button>
        </div>
        {exportError && <DismissibleBanner role="alert" onDismiss={() => setExportError(null)} className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{exportError}</DismissibleBanner>}
      </section>}

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or fellowship…"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={designationFilter}
            onChange={e => setDesignationFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Designations</option>
            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={fellowshipFilter}
            onChange={e => setFellowshipFilter(e.target.value)}
            disabled={Boolean(fellowshipScope)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:hidden"
          >
            <option value="all">All Fellowships</option>
            {fellowships.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {!showArchived && <select aria-label="Filter members by cell" value={cellFilter} onChange={event => setCellFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="all">All Cells</option><option value="unassigned">No Cell Assigned</option>
            {cells.filter(cell => !fellowshipScope || cell.fellowship === fellowshipScope).map(cell => <option key={cell.id} value={cell.id}>{!fellowshipScope ? `${cell.fellowship} · ` : ''}Cell {cell.number}</option>)}
          </select>}
          {!showArchived && <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" id="excel-upload-roster" />
            <label htmlFor="excel-upload-roster" className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition cursor-pointer whitespace-nowrap flex items-center justify-center">
              Import Database
            </label>
            <button
              onClick={openAdd}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap flex items-center justify-center"
            >
              + Add Member
            </button>
          </div>}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Showing {filtered.length} of {members.length} members
        </p>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingMember ? 'Edit Member' : 'Add Member to Roster'}
            </h3>

            {formError && (
              <DismissibleBanner onDismiss={() => setFormError(null)} role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</DismissibleBanner>
            )}

            {needsSignIn && <MemberEditSignIn onSignedIn={() => {
              setNeedsSignIn(false);
              setFormError(null);
              setSignInNotice('Signed in. Your edits are preserved — select Save Changes to save them.');
            }} />}
            {signInNotice && <DismissibleBanner onDismiss={() => setSignInNotice(null)} className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{signInNotice}</DismissibleBanner>}

            <div className="space-y-3">
              {[
                { label: 'Full Name *', field: 'name', placeholder: 'Enter full name', type: 'text' },
                { label: 'Phone', field: 'phone', placeholder: 'Phone number', type: 'tel' },
                { label: 'Location', field: 'location', placeholder: 'Location / Area', type: 'text' },
                { label: 'Birthday (DD-MM)', field: 'birthday', placeholder: 'e.g. 15-04', type: 'text' },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fellowship *</label>
                  <select
                    value={form.fellowship}
                    disabled={Boolean(fellowshipScope)}
                    onChange={e => setForm({ ...form, fellowship: e.target.value, cell_id: null, bsct_group_id: null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="" disabled>Select a fellowship</option>
                    <option value="Unassigned">Unassigned</option>
                    {FELLOWSHIPS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cell</label>
                <select value={form.cell_id || ''} onChange={event => setForm(current => ({ ...current, cell_id: event.target.value || null, bsct_group_id: null }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">Not assigned to a cell</option>
                  {cells.filter(cell => cell.fellowship === form.fellowship).map(cell => <option key={cell.id} value={cell.id}>Cell {cell.number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">BSCT Group</label>
                <select disabled={!form.cell_id} value={form.bsct_group_id || ''} onChange={event => setForm(current => ({ ...current, bsct_group_id: event.target.value || null }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">Not assigned to a BSCT group</option>
                  {bsctGroups.filter(group => group.cell_id === form.cell_id).map(group => <option key={group.id} value={group.id}>BSCT {group.number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Designation *</label>
                <select
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || needsSignIn}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {isSaving ? 'Saving…' : editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-600 font-medium">
            {members.length === 0 ? showArchived ? 'No archived brethren' : 'No members yet' : 'No members match your filters'}
          </p>
          {members.length === 0 && !showArchived && (
            <p className="text-sm text-gray-400 mt-1">
              Click &quot;Add Member&quot; to build the roster used for Cell Leader Check-In.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Phone', 'Fellowship', 'Cell / BSCT', 'Designation', 'Birthday', 'Location', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {member.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-900">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{member.phone || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{member.fellowship || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{member.cell_id ? `Cell ${cells.find(cell => cell.id === member.cell_id)?.number || '—'}` : 'Unassigned'}{member.bsct_group_id && <span className="block text-xs text-indigo-700">BSCT {bsctGroups.find(group => group.id === member.bsct_group_id)?.number || '—'}</span>}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${designationColors[member.designation] || designationColors['Member']}`}>
                        {member.designation}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{member.birthday || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{member.location || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {!showArchived && <button
                          onClick={() => openEdit(member)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                        >
                          Edit
                        </button>}
                        <button
                          onClick={() => handleArchive(member.id, showArchived)}
                          disabled={deletingId === member.id}
                          className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {deletingId === member.id ? '…' : showArchived ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
