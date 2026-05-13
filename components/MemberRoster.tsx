'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Member {
  id: string;
  name: string;
  phone: string;
  fellowship: string;
  designation: string;
  birthday: string;
  location: string;
}

const DESIGNATIONS = ['Fellowship Leader', 'Cell Leader', 'BSCT Leader', 'Member'] as const;

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-700',
  'Cell Leader': 'bg-blue-100 text-blue-700',
  'BSCT Leader': 'bg-amber-100 text-amber-700',
  'Member': 'bg-gray-100 text-gray-600',
};

const emptyForm = (): Omit<Member, 'id'> => ({
  name: '', phone: '', fellowship: '', designation: 'Cell Leader', birthday: '', location: '',
});

export default function MemberRoster() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fellowshipFilter, setFellowshipFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, 'id'>>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/members');
      if (res.ok) setMembers(await res.json());
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const fellowships = Array.from(new Set(members.map(m => m.fellowship).filter(Boolean))).sort();

  const filtered = members.filter(m => {
    const matchFellowship = fellowshipFilter === 'all' || m.fellowship === fellowshipFilter;
    const matchDesignation = designationFilter === 'all' || m.designation === designationFilter;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.fellowship.toLowerCase().includes(q) || m.phone.includes(q);
    return matchFellowship && matchDesignation && matchSearch;
  });

  const openAdd = () => {
    setEditingMember(null);
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    setEditingMember(m);
    setForm({ name: m.name, phone: m.phone, fellowship: m.fellowship, designation: m.designation, birthday: m.birthday, location: m.location });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccessMsg(isEdit ? 'Member updated.' : 'Member added to roster.');
        setShowForm(false);
        await fetchMembers();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const d = await res.json();
        setFormError(d.error || 'Failed to save member.');
      }
    } catch { setFormError('An error occurred.'); }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this member from the roster?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('Member removed.');
        await fetchMembers();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch {}
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
            fellowship: fellowshipIdx !== -1 ? String(row[fellowshipIdx] || '').trim() : '',
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
        .then(res => {
          if (res.ok) {
            setSuccessMsg(`Imported and saved ${imported.length} members to roster.`);
            fetchMembers();
            setTimeout(() => setSuccessMsg(null), 5000);
          } else {
            setFormError(`Failed to sync database.`);
            setIsLoading(false);
          }
        })
        .catch(() => {
          setFormError(`Failed to sync database.`);
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
      {/* Success banner */}
      {successMsg && (
        <div className="p-3 bg-green-100 text-green-800 rounded-xl text-sm font-medium">{successMsg}</div>
      )}

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
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Fellowships</option>
            {fellowships.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex gap-2">
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
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Showing {filtered.length} of {members.length} members
        </p>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingMember ? 'Edit Member' : 'Add Member to Roster'}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>
            )}

            <div className="space-y-3">
              {[
                { label: 'Full Name *', field: 'name', placeholder: 'Enter full name', type: 'text' },
                { label: 'Phone', field: 'phone', placeholder: 'Phone number', type: 'tel' },
                { label: 'Fellowship *', field: 'fellowship', placeholder: 'Fellowship name', type: 'text' },
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
                disabled={isSaving}
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
            {members.length === 0 ? 'No members yet' : 'No members match your filters'}
          </p>
          {members.length === 0 && (
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
                  {['Name', 'Phone', 'Fellowship', 'Designation', 'Birthday', 'Location', 'Actions'].map(h => (
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
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${designationColors[member.designation] || designationColors['Member']}`}>
                        {member.designation}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{member.birthday || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{member.location || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(member)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
                          disabled={deletingId === member.id}
                          className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {deletingId === member.id ? '…' : 'Remove'}
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
