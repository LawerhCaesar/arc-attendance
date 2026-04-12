'use client';

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceEntry {
  id: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  designation: string;
  firstTimer: boolean;
}

interface RosterMember {
  id: string;
  name: string;
  phone: string;
  fellowship: string;
  designation: string;
  birthday: string;
  location: string;
}

const DESIGNATIONS = ['Fellowship Leader', 'Cell Leader', 'BSCT Leader', 'Member'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (date: Date = new Date()): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const getOrdinal = (n: number) => {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };
  return `${dayName}, ${day}${getOrdinal(day)} ${month}, ${year}`;
};

const getTodayKey = () => `attendance-${new Date().toISOString().split('T')[0]}`;

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-800',
  'Cell Leader': 'bg-blue-100 text-blue-800',
  'BSCT Leader': 'bg-amber-100 text-amber-800',
  'Member': 'bg-gray-100 text-gray-700',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EntryPage() {
  // Tab
  const [activeTab, setActiveTab] = useState<'entries' | 'cell-leaders'>('entries');

  // ── Regular Entries State ──
  const [entries, setEntries] = useState<AttendanceEntry[]>([{
    id: Date.now().toString(),
    name: '', phone: '', location: '', birthday: '', fellowship: '', designation: 'Member', firstTimer: false,
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittedEntries, setSubmittedEntries] = useState<AttendanceEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [markedPresent, setMarkedPresent] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ── Cell Leader State ──
  const [cellLeaders, setCellLeaders] = useState<RosterMember[]>([]);
  const [presentCLIds, setPresentCLIds] = useState<Set<string>>(new Set());
  const [clFellowshipFilter, setClFellowshipFilter] = useState('all');
  const [clSearch, setClSearch] = useState('');
  const [isLoadingCL, setIsLoadingCL] = useState(false);
  const [clMessage, setClMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingCL, setIsSubmittingCL] = useState(false);
  const [clSubmitted, setClSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const entriesRef = useRef<AttendanceEntry[]>([]);
  const markedPresentRef = useRef<Set<string>>(new Set());
  const fetchSubmittedEntriesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { markedPresentRef.current = markedPresent; }, [markedPresent]);

  // ── Persistence ──
  const loadPersistedData = () => {
    try {
      const stored = localStorage.getItem(getTodayKey());
      if (stored) {
        const data = JSON.parse(stored);
        if (data.date === new Date().toISOString().split('T')[0]) {
          if (data.entries?.length > 0) setEntries(data.entries);
          if (data.markedPresent) setMarkedPresent(new Set(data.markedPresent));
        }
      }
    } catch {}
  };

  const savePersistedData = (e: AttendanceEntry[], m: Set<string>) => {
    try {
      localStorage.setItem(getTodayKey(), JSON.stringify({
        entries: e,
        markedPresent: Array.from(m),
        date: new Date().toISOString().split('T')[0],
      }));
    } catch {}
  };

  const clearOldData = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('attendance-') && key !== `attendance-${today}`)
          localStorage.removeItem(key);
      });
    } catch {}
  };

  // ── Fetch Submitted Entries ──
  const fetchSubmittedEntries = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/attendance');
      if (res.ok) setSubmittedEntries(await res.json());
    } catch {} finally { setIsLoading(false); }
  };

  useEffect(() => { fetchSubmittedEntriesRef.current = fetchSubmittedEntries; }, []);

  // ── Fetch Cell Leaders ──
  const fetchCellLeaders = async () => {
    setIsLoadingCL(true);
    try {
      const res = await fetch('/api/members?designation=Cell Leader');
      if (res.ok) {
        const data: RosterMember[] = await res.json();
        setCellLeaders(data);
      }
    } catch {
      setClMessage({ type: 'error', text: 'Failed to load cell leaders roster.' });
    } finally {
      setIsLoadingCL(false);
    }
  };

  // ── Auto submit absent at 23:59 ──
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(23, 59, 0, 0);
      if (now >= target) target.setDate(target.getDate() + 1);
      const ms = target.getTime() - now.getTime();

      const id = setTimeout(async () => {
        const absentEntries = entriesRef.current.filter(e =>
          e.name.trim() && e.phone.trim() && e.fellowship.trim() &&
          !markedPresentRef.current.has(e.id)
        );
        if (absentEntries.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          await Promise.allSettled(absentEntries.map(e =>
            fetch('/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: e.name, phone: e.phone, location: e.location,
                birthday: e.birthday, fellowship: e.fellowship,
                designation: e.designation, firstTimer: e.firstTimer,
                attendanceDate: today, attendanceStatus: 'absent',
              }),
            })
          ));
          if (fetchSubmittedEntriesRef.current) await fetchSubmittedEntriesRef.current();
        }
        schedule();
      }, ms);

      return () => clearTimeout(id);
    };

    const cleanup = schedule();
    return cleanup;
  }, []);

  useEffect(() => {
    clearOldData();
    loadPersistedData();
    fetchSubmittedEntries();
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    if (!isInitialLoad) savePersistedData(entries, markedPresent);
  }, [entries, markedPresent, isInitialLoad]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'cell-leaders' && cellLeaders.length === 0 && !isLoadingCL) {
      fetchCellLeaders();
    }
  }, [activeTab]);

  // ── Regular Entry Handlers ──
  const handleCellChange = (id: string, field: keyof AttendanceEntry, value: string | boolean) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
    setMessage(null);
  };

  const addRow = () => {
    const newId = Date.now().toString();
    setEntries([{
      id: newId,
      name: '', phone: '', location: '', birthday: '', fellowship: '', designation: 'Member', firstTimer: false,
    }, ...entries]);
    setEditingId(newId);
  };

  const removeRow = (id: string) => {
    if (entries.length > 1) { setEntries(entries.filter(e => e.id !== id)); setEditingId(null); }
  };

  const handleMarkPresent = (id: string) => {
    setMarkedPresent(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMessage(null);

    const marked = entries.filter(e =>
      markedPresent.has(e.id) && e.name.trim() && e.phone.trim() && e.location.trim() &&
      e.birthday.trim() && e.fellowship.trim()
    );

    if (marked.length === 0) {
      setMessage({ type: 'error', text: 'Please mark at least one entry as present.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const responses = await Promise.all(marked.map(e =>
        fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: e.name, phone: e.phone, location: e.location,
            birthday: e.birthday, fellowship: e.fellowship,
            designation: e.designation, firstTimer: e.firstTimer,
            attendanceDate: today, attendanceStatus: 'present',
          }),
        })
      ));

      const hasError = responses.some(r => !r.ok);
      if (hasError) {
        setMessage({ type: 'error', text: 'Some entries failed to submit. Please try again.' });
      } else {
        setMessage({ type: 'success', text: `${marked.length} record(s) submitted successfully!` });
        const remaining = entries.filter(e => !markedPresent.has(e.id));
        setEntries(remaining.length === 0 ? [{
          id: Date.now().toString(),
          name: '', phone: '', location: '', birthday: '', fellowship: '', designation: 'Member', firstTimer: false,
        }] : remaining);
        const newMarked = new Set(markedPresent);
        marked.forEach(e => newMarked.delete(e.id));
        setMarkedPresent(newMarked);
        await fetchSubmittedEntries();
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Excel Import ──
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
        if (json.length < 2) { setMessage({ type: 'error', text: 'File must have at least a header row and one data row' }); return; }

        const headers = json[0].map((h: any) => String(h).toLowerCase().trim());
        const nameIdx = headers.findIndex((h: string) => h.includes('name'));
        const phoneIdx = headers.findIndex((h: string) => h.includes('contact') || h.includes('phone'));
        const locationIdx = headers.findIndex((h: string) => h.includes('location'));
        const birthdayIdx = headers.findIndex((h: string) => h.includes('birthday') || h.includes('birth') || h.includes('dob'));
        const fellowshipIdx = headers.findIndex((h: string) => h.includes('fellowship'));
        const designationIdx = headers.findIndex((h: string) => h.includes('designation') || h.includes('role'));
        const firstTimerIdx = headers.findIndex((h: string) => h.includes('first'));

        if (nameIdx === -1 || locationIdx === -1 || fellowshipIdx === -1) {
          setMessage({ type: 'error', text: 'File must contain: NAME, LOCATION, FELLOWSHIP columns' });
          return;
        }

        const imported: AttendanceEntry[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row?.length) continue;
          const name = String(row[nameIdx] || '').trim();
          if (!name) continue;

          // Parse birthday
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

          const designation = designationIdx !== -1
            ? String(row[designationIdx] || 'Member').trim()
            : 'Member';

          imported.push({
            id: `${Date.now()}-${i}`,
            name,
            phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
            location: String(row[locationIdx] || '').trim(),
            birthday,
            fellowship: String(row[fellowshipIdx] || '').trim(),
            designation: DESIGNATIONS.includes(designation as any) ? designation : 'Member',
            firstTimer: firstTimerIdx !== -1
              ? ['yes', 'true', '1', 'y'].includes(String(row[firstTimerIdx] || '').toLowerCase().trim())
              : false,
          });
        }

        if (imported.length === 0) { setMessage({ type: 'error', text: 'No valid entries found' }); return; }
        setEntries(imported);
        setMessage({ type: 'success', text: `Imported ${imported.length} entries from Excel` });
      } catch { setMessage({ type: 'error', text: 'Error parsing Excel file.' }); }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Cell Leader Handlers ──
  const toggleCLPresent = (id: string) => {
    setPresentCLIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markAllCLPresent = () => {
    const visible = filteredCellLeaders.map(cl => cl.id);
    setPresentCLIds(prev => {
      const next = new Set(prev);
      visible.forEach(id => next.add(id));
      return next;
    });
  };

  const clearAllCLPresent = () => {
    const visible = new Set(filteredCellLeaders.map(cl => cl.id));
    setPresentCLIds(prev => {
      const next = new Set(prev);
      visible.forEach(id => next.delete(id));
      return next;
    });
  };

  const handleCLSubmit = async () => {
    setIsSubmittingCL(true);
    setClMessage(null);

    // Submit ALL visible cell leaders as present OR absent
    const toSubmit = filteredCellLeaders;
    if (toSubmit.length === 0) {
      setClMessage({ type: 'error', text: 'No cell leaders to submit.' });
      setIsSubmittingCL(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const responses = await Promise.allSettled(
        toSubmit.map(cl =>
          fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: cl.name,
              phone: cl.phone,
              location: cl.location,
              birthday: cl.birthday,
              fellowship: cl.fellowship,
              designation: cl.designation,
              firstTimer: false,
              attendanceDate: today,
              attendanceStatus: presentCLIds.has(cl.id) ? 'present' : 'absent',
            }),
          })
        )
      );

      const failed = responses.filter(r => r.status === 'rejected').length;
      const presentCount = toSubmit.filter(cl => presentCLIds.has(cl.id)).length;
      const absentCount = toSubmit.length - presentCount;

      if (failed > 0) {
        setClMessage({ type: 'error', text: `${failed} record(s) failed to submit. Please try again.` });
      } else {
        setClMessage({
          type: 'success',
          text: `Attendance recorded: ${presentCount} present, ${absentCount} absent.`,
        });
        setClSubmitted(true);
        await fetchSubmittedEntries();
      }
    } catch {
      setClMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmittingCL(false);
    }
  };

  // ── Derived ──
  const fellowshipOptions = Array.from(new Set(cellLeaders.map(cl => cl.fellowship))).sort();

  const filteredCellLeaders = cellLeaders.filter(cl => {
    const matchesFellowship = clFellowshipFilter === 'all' || cl.fellowship === clFellowshipFilter;
    const matchesSearch = !clSearch.trim() ||
      cl.name.toLowerCase().includes(clSearch.toLowerCase()) ||
      cl.fellowship.toLowerCase().includes(clSearch.toLowerCase());
    return matchesFellowship && matchesSearch;
  });

  const clPresentCount = filteredCellLeaders.filter(cl => presentCLIds.has(cl.id)).length;
  const clAbsentCount = filteredCellLeaders.length - clPresentCount;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed relative"
      style={{ backgroundImage: 'url(/background.jpg)' }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Tab switcher */}
          <div className="flex gap-1 mb-6 p-1 bg-black/30 backdrop-blur-sm rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('entries')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'entries'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📋 New Entries
            </button>
            <button
              onClick={() => setActiveTab('cell-leaders')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'cell-leaders'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              ✅ Cell Leader Check-In
            </button>
          </div>

          {/* ── TAB 1: Regular Entries ───────────────────────────────────────── */}
          {activeTab === 'entries' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Mark Attendance</h1>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Total: <span className="font-semibold text-gray-900">{entries.length}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Marked Present: <span className="font-semibold text-green-600">{markedPresent.size}</span>
                    </div>
                  </div>
                </div>
                <div className="space-x-2 flex items-center">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" id="excel-upload" />
                  <label htmlFor="excel-upload" className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition cursor-pointer text-sm">
                    Import Excel
                  </label>
                  <button onClick={addRow} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm">
                    Add Row
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    {isSubmitting ? 'Submitting…' : `Submit Present (${markedPresent.size})`}
                  </button>
                </div>
              </div>

              {message && (
                <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message.text}
                </div>
              )}

              <div className="mb-4 pb-3 border-b border-gray-300">
                <p className="text-lg font-semibold text-gray-700">{formatDate()}</p>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, location, or fellowship…"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      {['NAME', 'CONTACT', 'DATE OF BIRTH', 'LOCATION', 'FELLOWSHIP', 'DESIGNATION', 'FIRST TIME?', 'ACTIONS'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300 last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {entries
                      .filter(entry => {
                        if (!searchQuery.trim()) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          entry.name.toLowerCase().includes(q) ||
                          entry.phone.toLowerCase().includes(q) ||
                          entry.location.toLowerCase().includes(q) ||
                          entry.fellowship.toLowerCase().includes(q)
                        );
                      })
                      .map(entry => {
                        const isEditing = editingId === entry.id;
                        const isPresent = markedPresent.has(entry.id);
                        const inputCls = (editing: boolean) =>
                          `w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${!editing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`;

                        return (
                          <tr key={entry.id} className={`hover:bg-gray-50 ${isPresent ? 'bg-green-50' : ''}`}>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input type="text" value={entry.name} onChange={e => handleCellChange(entry.id, 'name', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Full name" />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input type="tel" value={entry.phone} onChange={e => handleCellChange(entry.id, 'phone', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Phone number" />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input type="date" value={entry.birthday} onChange={e => handleCellChange(entry.id, 'birthday', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input type="text" value={entry.location} onChange={e => handleCellChange(entry.id, 'location', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Location" />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input type="text" value={entry.fellowship} onChange={e => handleCellChange(entry.id, 'fellowship', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Fellowship" />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              {isEditing ? (
                                <select
                                  value={entry.designation}
                                  onChange={e => handleCellChange(entry.id, 'designation', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                >
                                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${designationColors[entry.designation] || designationColors['Member']}`}>
                                  {entry.designation || 'Member'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <div className="flex items-center justify-center">
                                <input type="checkbox" checked={entry.firstTimer} onChange={e => handleCellChange(entry.id, 'firstTimer', e.target.checked)} disabled={!isEditing} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition">Save</button>
                                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition">Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => setEditingId(entry.id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition whitespace-nowrap min-w-[45px]">Edit</button>
                                    <button
                                      onClick={() => handleMarkPresent(entry.id)}
                                      className={`px-3 py-1 text-xs rounded transition whitespace-nowrap min-w-[80px] ${isPresent ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                      {isPresent ? '✓ Present' : 'Mark Present'}
                                    </button>
                                  </>
                                )}
                                {entries.length > 1 && !isEditing && (
                                  <button onClick={() => removeRow(entry.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition">✕</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Submitted Entries */}
              {submittedEntries.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">Submitted Entries</h2>
                  <div className="mb-4">
                    <input
                      type="text"
                      value={submittedSearchQuery}
                      onChange={e => setSubmittedSearchQuery(e.target.value)}
                      placeholder="Search submitted entries…"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {['NAME', 'CONTACT', 'DATE OF BIRTH', 'LOCATION', 'FELLOWSHIP', 'DESIGNATION', 'STATUS', 'FIRST TIME?'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {submittedEntries
                          .filter(e => {
                            if (!submittedSearchQuery.trim()) return true;
                            const q = submittedSearchQuery.toLowerCase();
                            return e.name.toLowerCase().includes(q) || e.phone.toLowerCase().includes(q) || e.fellowship.toLowerCase().includes(q);
                          })
                          .map((entry, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.phone}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.birthday || '—'}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.location}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.fellowship}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${designationColors[(entry as any).designation || 'Member'] || designationColors['Member']}`}>
                                  {(entry as any).designation || 'Member'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {(entry as any).attendanceStatus && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(entry as any).attendanceStatus === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {(entry as any).attendanceStatus}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.firstTimer ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {entry.firstTimer ? 'Yes' : 'No'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: Cell Leader Check-In ──────────────────────────────────── */}
          {activeTab === 'cell-leaders' && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">Cell Leader Check-In</h1>
                    <p className="text-sm text-gray-500 mt-1">{formatDate()} — Tap a name to mark present</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={markAllCLPresent}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                    >
                      ✓ Mark All Present
                    </button>
                    <button
                      onClick={clearAllCLPresent}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => { fetchCellLeaders(); setPresentCLIds(new Set()); setClSubmitted(false); setClMessage(null); }}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                    >
                      ↺ Reload
                    </button>
                  </div>
                </div>

                {/* Stats bar */}
                <div className="mt-4 flex gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-gray-700">Present: <strong className="text-green-600">{clPresentCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-sm font-medium text-gray-700">Absent: <strong className="text-red-600">{clAbsentCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Total: <strong>{filteredCellLeaders.length}</strong></span>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={clSearch}
                  onChange={e => setClSearch(e.target.value)}
                  placeholder="Search cell leaders…"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={clFellowshipFilter}
                  onChange={e => setClFellowshipFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Fellowships</option>
                  {fellowshipOptions.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Message */}
              {clMessage && (
                <div className={`p-4 rounded-xl ${clMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {clMessage.text}
                </div>
              )}

              {/* Cell leader cards */}
              {isLoadingCL ? (
                <div className="bg-white rounded-xl shadow-md p-12 flex items-center justify-center">
                  <div className="text-gray-500 text-lg">Loading cell leaders…</div>
                </div>
              ) : filteredCellLeaders.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-12 text-center">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-gray-600 font-medium">No cell leaders found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {cellLeaders.length === 0
                      ? 'Add cell leaders to the Members Roster in the Admin Dashboard first.'
                      : 'No results for the selected filter.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredCellLeaders.map(cl => {
                    const isPresent = presentCLIds.has(cl.id);
                    return (
                      <button
                        key={cl.id}
                        onClick={() => !clSubmitted && toggleCLPresent(cl.id)}
                        disabled={clSubmitted}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 shadow-sm focus:outline-none ${
                          isPresent
                            ? 'border-green-400 bg-green-50 shadow-green-100'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                        } ${clSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                      >
                        {/* Present badge */}
                        {isPresent && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        )}
                        {!isPresent && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-400 text-xs font-bold">✗</span>
                          </div>
                        )}

                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-3 ${isPresent ? 'bg-green-500' : 'bg-gray-400'}`}>
                          {cl.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>

                        {/* Name */}
                        <p className={`font-semibold text-sm leading-tight ${isPresent ? 'text-green-800' : 'text-gray-800'}`}>
                          {cl.name}
                        </p>

                        {/* Fellowship */}
                        <p className="text-xs text-gray-500 mt-1 truncate">{cl.fellowship}</p>

                        {/* Status */}
                        <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isPresent ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}>
                          {isPresent ? 'Present' : 'Absent'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Submit button */}
              {filteredCellLeaders.length > 0 && !clSubmitted && (
                <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Ready to record: <strong className="text-green-600">{clPresentCount} present</strong> and <strong className="text-red-600">{clAbsentCount} absent</strong>
                  </div>
                  <button
                    onClick={handleCLSubmit}
                    disabled={isSubmittingCL}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    {isSubmittingCL ? 'Recording…' : `Submit Attendance (${filteredCellLeaders.length})`}
                  </button>
                </div>
              )}

              {clSubmitted && (
                <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between">
                  <div className="text-green-700 font-medium text-sm">✓ Attendance recorded for today</div>
                  <button
                    onClick={() => { setPresentCLIds(new Set()); setClSubmitted(false); setClMessage(null); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
                  >
                    Start Over
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
