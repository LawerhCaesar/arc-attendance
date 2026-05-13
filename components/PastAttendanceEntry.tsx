'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

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

const DESIGNATIONS = ['Fellowship Leader', 'Cell Leader', 'BSCT Leader', 'Member'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateDisplay = (date: Date): string => {
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

const formatDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-800',
  'Cell Leader': 'bg-blue-100 text-blue-800',
  'BSCT Leader': 'bg-amber-100 text-amber-800',
  'Member': 'bg-gray-100 text-gray-700',
};

const getTargetSundays = () => {
  const sundays = [];
  const currentYear = new Date().getFullYear();
  // Start from January 1st
  const date = new Date(currentYear, 0, 1); 
  
  // Advance to the first Sunday of the year
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }

  // Generate Sundays until the end of the year
  while (date.getFullYear() === currentYear) {
    sundays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  
  return sundays;
};

// ─── Fancy Birthday Picker ─────────────────────────────────────────────────────

const FancyBirthdayPicker = ({ value, onChange, disabled }: { value: string, onChange: (val: string) => void, disabled: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  let initialDay = '01';
  let initialMonth = '01';
  if (value && value.includes('-')) {
    const parts = value.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      initialMonth = parts[1];
      initialDay = parts[2];
    } else {
      initialDay = parts[0];
      initialMonth = parts[1];
    }
  }

  const [selMonth, setSelMonth] = useState(initialMonth);
  const [selDay, setSelDay] = useState(initialDay);

  const months = [
    { num: '01', name: 'Jan' }, { num: '02', name: 'Feb' }, { num: '03', name: 'Mar' },
    { num: '04', name: 'Apr' }, { num: '05', name: 'May' }, { num: '06', name: 'Jun' },
    { num: '07', name: 'Jul' }, { num: '08', name: 'Aug' }, { num: '09', name: 'Sep' },
    { num: '10', name: 'Oct' }, { num: '11', name: 'Nov' }, { num: '12', name: 'Dec' },
  ];

  const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'));

  const handleSave = () => {
    onChange(`${selDay}-${selMonth}`);
    setIsOpen(false);
  };

  return (
    <>
      <div 
        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus-within:ring-1 focus-within:ring-blue-500 flex justify-between items-center transition ${!disabled ? 'bg-white hover:border-blue-400' : 'bg-gray-100 cursor-not-allowed text-gray-500'}`}
        style={{ minHeight: '30px' }}
      >
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          disabled={disabled}
          placeholder="DD-MM"
          className="w-full truncate mr-2 bg-transparent outline-none text-gray-900" 
        />
        <span 
          onClick={() => !disabled && setIsOpen(true)}
          className={`text-gray-400 text-xs ${!disabled ? 'cursor-pointer hover:text-blue-500' : ''}`}
        >
          📅
        </span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div 
            className="bg-white shadow-2xl rounded-2xl p-6 w-full max-w-sm transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-gray-900 text-lg">Select Birthday</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition">✕</button>
            </div>
            
            <div className="mb-5">
              <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">Month</label>
              <div className="grid grid-cols-4 gap-2">
                {months.map(m => (
                  <button
                    key={m.num}
                    onClick={() => setSelMonth(m.num)}
                    className={`py-2 rounded-lg text-sm font-medium transition ${selMonth === m.num ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-50 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">Day</label>
              <div className="grid grid-cols-7 gap-1">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelDay(d)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition ${selDay === d ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    {parseInt(d, 10)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
              <button 
                onClick={handleSave}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-blue-200"
              >
                Save Date
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PastAttendanceEntry() {
  const sundays = useMemo(() => getTargetSundays(), []);
  
  const [selectedDateIso, setSelectedDateIso] = useState<string>(sundays.length > 0 ? formatDateIso(sundays[0]) : '');
  
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [markedPresent, setMarkedPresent] = useState<Set<string>>(new Set());
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((m: any) => ({
          id: m.id || Date.now().toString() + Math.random(),
          name: m.name,
          phone: m.phone,
          location: m.location,
          birthday: m.birthday,
          fellowship: m.fellowship,
          designation: m.designation || 'Member',
          firstTimer: false,
        }));
        setEntries(formatted);
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Failed to load members from database.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const draftStr = typeof window !== 'undefined' ? sessionStorage.getItem('pastAttendanceDraft') : null;
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.entries && draft.entries.length > 0) {
          setEntries(draft.entries);
          if (draft.markedPresent) setMarkedPresent(new Set(draft.markedPresent));
          if (draft.selectedDateIso) setSelectedDateIso(draft.selectedDateIso);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
    fetchMembers();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const draft = {
      entries,
      markedPresent: Array.from(markedPresent),
      selectedDateIso,
    };
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pastAttendanceDraft', JSON.stringify(draft));
    }
  }, [entries, markedPresent, selectedDateIso, isLoading]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear state when selected date changes to avoid accidental submissions
  const handleDateChange = (isoDate: string) => {
    setSelectedDateIso(isoDate);
    setMarkedPresent(new Set());
    setMessage(null);
    setEntryErrors({});
  };

  // ── Handlers ──
  const handleCellChange = (id: string, field: keyof AttendanceEntry, value: string | boolean) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
    setMessage(null);
    if (entryErrors[id]) {
      setEntryErrors(prev => { const next = {...prev}; delete next[id]; return next; });
    }
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

  const markAllPresent = () => {
    const filteredEntries = entries.filter(entry => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.phone.toLowerCase().includes(q) ||
        entry.location.toLowerCase().includes(q) ||
        entry.fellowship.toLowerCase().includes(q)
      );
    });
    
    setMarkedPresent(prev => {
      const next = new Set(prev);
      filteredEntries.forEach(e => {
        if (e.name.trim()) next.add(e.id);
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedDateIso) {
      setMessage({ type: 'error', text: 'Please select a date first.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const validEntries = entries.filter(e => e.name.trim());

    if (validEntries.length === 0) {
      setMessage({ type: 'error', text: 'No entries to submit.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const results = await Promise.all(validEntries.map(async (e) => {
        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: e.name, phone: e.phone, location: e.location,
              birthday: e.birthday, fellowship: e.fellowship,
              designation: e.designation, firstTimer: e.firstTimer,
              attendanceDate: selectedDateIso, 
              attendanceStatus: markedPresent.has(e.id) ? 'present' : 'absent',
            }),
          });
          
          let errorMsg = null;
          if (!res.ok) {
            try {
               const data = await res.json();
               errorMsg = data.error || `Server error ${res.status}`;
            } catch {
               errorMsg = `Server error ${res.status}`;
            }
          }
          return { id: e.id, ok: res.ok, errorMsg };
        } catch (err) {
          return { id: e.id, ok: false, errorMsg: 'Network error' };
        }
      }));

      const newErrors: Record<string, string> = {};
      results.forEach(r => {
        if (!r.ok && r.errorMsg) {
          newErrors[r.id] = r.errorMsg;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setEntryErrors(newErrors);
        setMessage({ type: 'error', text: 'Some entries failed to submit. Please fix the highlighted rows below and try again.' });
      } else {
        const presentCount = validEntries.filter(e => markedPresent.has(e.id)).length;
        const absentCount = validEntries.length - presentCount;
        setMessage({ type: 'success', text: `Submitted successfully for ${selectedDateIso}: ${presentCount} present, ${absentCount} absent.` });
        setMarkedPresent(new Set());
        setEntryErrors({});
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pastAttendanceDraft');
        }
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
        
        // Sync to database immediately
        fetch('/api/members/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ members: imported }),
        })
        .then(res => {
          if (res.ok) {
            setMessage({ type: 'success', text: `Imported and saved ${imported.length} entries to database. Don't forget to mark present and submit!` });
          } else {
            setMessage({ type: 'success', text: `Imported ${imported.length} entries to session, but database sync failed.` });
          }
        })
        .catch(() => {
          setMessage({ type: 'success', text: `Imported ${imported.length} entries to session, but database sync failed.` });
        });
      } catch {
        setMessage({ type: 'error', text: 'Error parsing Excel file.' });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6 border-b border-gray-200 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Past Attendance Entry</h1>
          <p className="text-sm text-gray-500 mt-1">Record attendance for specific past Sundays</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Total Entries: <span className="font-semibold text-gray-900">{entries.length}</span>
            </div>
            <div className="text-sm text-gray-600">
              Marked Present: <span className="font-semibold text-green-600">{markedPresent.size}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 min-w-[250px]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Sunday</label>
            <select
              value={selectedDateIso}
              onChange={(e) => handleDateChange(e.target.value)}
              className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm bg-gray-50 border"
            >
              {sundays.map(date => {
                const iso = formatDateIso(date);
                const display = formatDateDisplay(date);
                return (
                  <option key={iso} value={iso}>
                    {display}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
        <div className="flex-1 min-w-[250px]">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, location, or fellowship…"
            className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" id="excel-upload-past" />
          <label htmlFor="excel-upload-past" className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition cursor-pointer text-sm whitespace-nowrap">
            Import Excel
          </label>
          <button onClick={addRow} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm whitespace-nowrap">
            Add Row
          </button>
          <button onClick={markAllPresent} className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition text-sm whitespace-nowrap">
            Mark All Visible Present
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm whitespace-nowrap"
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
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
                const hasError = !!entryErrors[entry.id];
                const rowClass = hasError ? 'bg-red-50 hover:bg-red-100' : (isPresent ? 'bg-green-50' : '');
                const inputCls = (editing: boolean) =>
                  `w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${!editing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`;

                return (
                  <React.Fragment key={entry.id}>
                    <tr className={`hover:bg-gray-50 ${rowClass}`}>
                      <td className="px-3 py-2 border-r border-gray-300">
                        <input type="text" value={entry.name} onChange={e => handleCellChange(entry.id, 'name', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Full name" />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
                        <input type="tel" value={entry.phone} onChange={e => handleCellChange(entry.id, 'phone', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Phone number" />
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300">
                        <FancyBirthdayPicker value={entry.birthday} onChange={(val: string) => handleCellChange(entry.id, 'birthday', val)} disabled={!isEditing} />
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
                    {hasError && (
                      <tr className="bg-red-50">
                        <td colSpan={8} className="px-3 py-1 text-red-600 text-xs font-semibold border-b border-red-200">
                          ⚠️ Error: {entryErrors[entry.id]}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
