'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { dateInAccra } from '@/lib/birthdays';
import { entryMetrics, reconcileEntryRoster } from '@/lib/entry-roster';
import DismissibleBanner from '@/components/DismissibleBanner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceEntry {
  id: string;
  rosterMemberId?: string;
  dirty?: boolean;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  designation: string;
  firstTimer: boolean;
  date?: string;
  attendanceStatus?: string;
  attendanceDate?: string;
}

interface LastSundayRecord {
  id: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  designation: string;
  firstTimer: boolean;
  attendanceDate: string;
  attendanceStatus: string;
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
const ROSTER_PAGE_SIZE = 25;

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

const getTodayKey = () => `attendance-${dateInAccra()}`;

/**
 * Returns the ISO date string (YYYY-MM-DD) of the most recent Sunday.
 * If today IS a Sunday, returns today. Otherwise returns the previous Sunday.
 * Service dates use the church's Ghana calendar, independent of device timezone.
 */
const getMostRecentSunday = (): string => {
  const sunday = new Date(`${dateInAccra()}T00:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday.toISOString().slice(0, 10);
};

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-800',
  'Cell Leader': 'bg-blue-100 text-blue-800',
  'BSCT Leader': 'bg-amber-100 text-amber-800',
  'Member': 'bg-gray-100 text-gray-700',
};

// ─── Fancy Birthday Picker ─────────────────────────────────────────────────────

const FancyBirthdayPicker = ({ value, onChange, disabled }: { value: string, onChange: (val: string) => void, disabled: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse existing
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
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterPage, setRosterPage] = useState(1);
  const [activeRosterCount, setActiveRosterCount] = useState<number | null>(null);
  const [serviceSummary, setServiceSummary] = useState<{ serviceDate: string; savedPresent: number } | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [rosterRecovery, setRosterRecovery] = useState<AttendanceEntry[]>([]);
  const [dismissedRecovery, setDismissedRecovery] = useState('');
  const recoveryKey = useMemo(() => rosterRecovery.map(row => row.id).sort().join('|'), [rosterRecovery]);

  // ── Last Sunday Edit State ──
  const [lastSundayRecords, setLastSundayRecords] = useState<LastSundayRecord[]>([]);
  const [isLoadingLastSunday, setIsLoadingLastSunday] = useState(false);
  const [lastSundayEditingId, setLastSundayEditingId] = useState<string | null>(null);
  const [lastSundayEdits, setLastSundayEdits] = useState<Record<string, Partial<LastSundayRecord>>>({});
  const [lastSundayMessage, setLastSundayMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingLastSunday, setIsSavingLastSunday] = useState(false);
  const [lastSundaySearch, setLastSundaySearch] = useState('');

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
  const summaryRequest = useRef(0);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { markedPresentRef.current = markedPresent; }, [markedPresent]);

  // ── Persistence ──
  const loadPersistedData = (): { entries: AttendanceEntry[]; marked: Set<string> } => {
    try {
      const stored = localStorage.getItem(getTodayKey());
      if (stored) {
        const data = JSON.parse(stored);
        if (data.date === dateInAccra()) {
          if (data.entries?.length > 0) {
            setEntries(data.entries);
            if (data.markedPresent) setMarkedPresent(new Set(data.markedPresent));
            return { entries: data.entries, marked: new Set<string>(data.markedPresent || []) };
          }
        }
      }
    } catch {}
    return { entries: [], marked: new Set<string>() };
  };

  const savePersistedData = (e: AttendanceEntry[], m: Set<string>) => {
    try {
      localStorage.setItem(getTodayKey(), JSON.stringify({
        entries: e,
        markedPresent: Array.from(m),
        date: dateInAccra(),
      }));
    } catch {}
  };

  const clearOldData = () => {
    try {
      const today = dateInAccra();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('attendance-') && key !== `attendance-${today}`)
          localStorage.removeItem(key);
      });
    } catch {}
  };

  // ── Fetch Submitted Entries ──
  const fetchServiceSummary = useCallback(async () => {
    const requestId = ++summaryRequest.current;
    try {
      const res = await fetch('/api/attendance/service-summary', { cache: 'no-store' });
      if (!res.ok) throw new Error('Summary unavailable');
      const result = await res.json();
      if (requestId === summaryRequest.current) {
        setServiceSummary(result);
        setSummaryError(false);
      }
    } catch {
      if (requestId === summaryRequest.current) {
        setServiceSummary(null);
        setSummaryError(true);
      }
    }
  }, []);

  const fetchSubmittedEntries = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/attendance', { cache: 'no-store' });
      if (res.ok) setSubmittedEntries(await res.json());
      else setSubmittedEntries([]);
    } catch {} finally { setIsLoading(false); }
  };

  useEffect(() => { fetchSubmittedEntriesRef.current = fetchSubmittedEntries; }, []);

  // ── Fetch Last Sunday Records (weekdays only) ──
  const fetchLastSundayRecords = async () => {
    setIsLoadingLastSunday(true);
    try {
      const res = await fetch(`/api/attendance/by-date?date=${getMostRecentSunday()}`, { cache: 'no-store' });
      if (res.ok) setLastSundayRecords(await res.json());
    } catch {} finally { setIsLoadingLastSunday(false); }
  };

  // ── Preload Member Roster ──
  const fetchMembersForRoster = async (restored?: { entries: AttendanceEntry[]; marked: Set<string> }) => {
    setIsLoadingRoster(true);
    try {
      const res = await fetch('/api/members', { cache: 'no-store' });
      if (!res.ok) throw new Error('Roster unavailable');
      if (res.ok) {
        const data = await res.json();
        const mapped: AttendanceEntry[] = data.map((m: any) => ({
          id: m.id || `${Date.now()}-${Math.random()}`,
          rosterMemberId: m.id,
          name: m.name || '',
          phone: m.phone || '',
          location: m.location || '',
          birthday: m.birthday || '',
          fellowship: m.fellowship || '',
          designation: m.designation || 'Member',
          firstTimer: false,
        }));
        const cached = restored?.entries ?? entriesRef.current;
        const reconciled = reconcileEntryRoster(mapped, cached, restored?.marked ?? markedPresentRef.current);
        if (reconciled.removed.length) {
          let recovery = reconciled.removed;
          try {
            const key = `arc-roster-recovery-${dateInAccra()}`;
            const old: AttendanceEntry[] = JSON.parse(localStorage.getItem(key) || '[]');
            recovery = Array.from(new Map([...(Array.isArray(old) ? old : []), ...recovery].map(row => [row.id, row])).values());
            localStorage.setItem(key, JSON.stringify(recovery));
          } catch {}
          setRosterRecovery(recovery);
        }
        setActiveRosterCount(mapped.length);
        setEntries(reconciled.entries);
        setMarkedPresent(reconciled.marked);
        setRosterPage(1);
        setMessage({ type: 'success', text: `Refreshed ${mapped.length} active roster members. Valid selections and drafts have been kept.${reconciled.removed.length ? ` ${reconciled.removed.length} old roster rows were removed from this worksheet; a recovery copy is available below.` : ''}` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load member roster.' });
    } finally {
      setIsLoadingRoster(false);
    }
  };

  // ── Fetch Cell Leaders ──
  const fetchCellLeaders = useCallback(async () => {
    setIsLoadingCL(true);
    try {
      const res = await fetch('/api/members?designation=Cell Leader,Fellowship Leader', { cache: 'no-store' });
      if (res.ok) {
        const data: RosterMember[] = await res.json();
        setCellLeaders(data);
      }
    } catch {
      setClMessage({ type: 'error', text: 'Failed to load cell leaders roster.' });
    } finally {
      setIsLoadingCL(false);
    }
  }, []);

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
          e.name.trim() &&
          !markedPresentRef.current.has(e.id)
        );
        if (absentEntries.length > 0) {
          const serviceDate = getMostRecentSunday();
          await Promise.allSettled(absentEntries.map(e =>
            fetch('/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: e.name, phone: e.phone, location: e.location,
                birthday: e.birthday, fellowship: e.fellowship,
                designation: e.designation, firstTimer: e.firstTimer,
                attendanceDate: serviceDate, attendanceStatus: 'absent',
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
    const restored = loadPersistedData();
    try { setDismissedRecovery(sessionStorage.getItem('dismissed-roster-recovery') || ''); } catch {}
    try {
      const recovered = JSON.parse(localStorage.getItem(`arc-roster-recovery-${dateInAccra()}`) || '[]');
      if (Array.isArray(recovered)) setRosterRecovery(recovered);
    } catch {}
    fetchSubmittedEntries();
    fetchServiceSummary();
    if (new Date().getDay() !== 0) {
      fetchLastSundayRecords();
    }
    fetchMembersForRoster(restored).finally(() => setIsInitialLoad(false));
  }, [fetchServiceSummary]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') fetchServiceSummary(); };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [fetchServiceSummary]);

  useEffect(() => {
    if (!isInitialLoad) savePersistedData(entries, markedPresent);
  }, [entries, markedPresent, isInitialLoad]);

  useEffect(() => {
    if (activeTab === 'cell-leaders' && cellLeaders.length === 0 && !isLoadingCL) {
      fetchCellLeaders();
    }
  }, [activeTab, cellLeaders.length, fetchCellLeaders, isLoadingCL]);

  // ── Regular Entry Handlers ──
  const handleCellChange = (id: string, field: keyof AttendanceEntry, value: string | boolean) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value, dirty: true } : e));
    setMessage(null);
  };

  const addRow = () => {
    const newId = Date.now().toString();
    setEntries([{
      id: newId,
      name: '', phone: '', location: '', birthday: '', fellowship: '', designation: 'Member', firstTimer: false,
    }, ...entries]);
    setRosterPage(1);
    setEditingId(newId);
  };

  const removeRow = (id: string) => {
    if (entries.length > 1) { setEntries(entries.filter(e => e.id !== id)); setEditingId(null); }
    setMarkedPresent(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleMarkPresent = (id: string) => {
    if (!entries.find(entry => entry.id === id)?.name.trim()) {
      setMessage({ type: 'error', text: 'Enter a name before selecting this person.' });
      return;
    }
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
      markedPresent.has(e.id) && e.name.trim()
    );

    if (marked.length === 0) {
      setMessage({ type: 'error', text: 'Please mark at least one entry as present.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const serviceDate = getMostRecentSunday();
      const responses = await Promise.allSettled(marked.map(e =>
        fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: e.name, phone: e.phone, location: e.location,
            birthday: e.birthday, fellowship: e.fellowship,
            designation: e.designation, firstTimer: e.firstTimer,
            attendanceDate: serviceDate, attendanceStatus: 'present',
          }),
        })
      ));

      const successful = new Set(marked.filter((_, index) => {
        const result = responses[index];
        return result.status === 'fulfilled' && result.value.ok;
      }).map(entry => entry.id));
      const failed = marked.length - successful.size;
      setMarkedPresent(previous => new Set(Array.from(previous).filter(id => !successful.has(id))));
      // The roster is stable after submitting. Only successfully submitted
      // one-off drafts leave the worksheet; failed selections remain for retry.
      setEntries(previous => previous.filter(entry => entry.rosterMemberId || !successful.has(entry.id)));
      setMessage(failed
        ? { type: 'error', text: `${successful.size} saved; ${failed} failed and remain selected for retry.` }
        : { type: 'success', text: `${successful.size} selection(s) saved. Confirmed attendance is shown separately below.` });
      await Promise.all([fetchSubmittedEntries(), fetchServiceSummary()]);
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
        setMarkedPresent(new Set());
        setRosterPage(1);
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
      const serviceDate = getMostRecentSunday();
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
              attendanceDate: serviceDate,
              attendanceStatus: presentCLIds.has(cl.id) ? 'present' : 'absent',
            }),
          })
        )
      );

      const failed = responses.filter(r => r.status === 'rejected' || !r.value.ok).length;
      const presentCount = toSubmit.filter(cl => presentCLIds.has(cl.id)).length;
      const absentCount = toSubmit.length - presentCount;

      if (failed > 0) {
        setClMessage({ type: 'error', text: `${failed} record(s) failed to submit. Please try again.` });
      } else {
        setClMessage({
          type: 'success',
          text: `Saved ${presentCount} present and ${absentCount} absent selections. Previously saved present records are preserved.`,
        });
        setClSubmitted(true);
        await fetchSubmittedEntries();
      }
      await fetchServiceSummary();
    } catch {
      setClMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmittingCL(false);
    }
  };

  // ── Last Sunday Handlers ──
  const handleLastSundayFieldChange = (id: string, field: keyof LastSundayRecord, value: string | boolean) => {
    setLastSundayEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleLastSundaySave = async (record: LastSundayRecord) => {
    setIsSavingLastSunday(true);
    setLastSundayMessage(null);
    const merged = { ...record, ...(lastSundayEdits[record.id] || {}) };
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: merged.name, phone: merged.phone, location: merged.location,
          birthday: merged.birthday, fellowship: merged.fellowship,
          designation: merged.designation, firstTimer: merged.firstTimer,
          attendanceDate: merged.attendanceDate, attendanceStatus: merged.attendanceStatus,
          explicitToggle: true,
        }),
      });
      if (res.ok) {
        setLastSundayRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...(lastSundayEdits[record.id] || {}) } : r));
        setLastSundayEdits(prev => { const n = { ...prev }; delete n[record.id]; return n; });
        setLastSundayEditingId(null);
        setLastSundayMessage({ type: 'success', text: `Updated ${merged.name} successfully.` });
      } else {
        setLastSundayMessage({ type: 'error', text: 'Failed to save changes.' });
      }
    } catch { setLastSundayMessage({ type: 'error', text: 'Network error. Please try again.' }); }
    finally { setIsSavingLastSunday(false); }
  };

  const toggleLastSundayStatus = async (record: LastSundayRecord) => {
    const newStatus = record.attendanceStatus === 'present' ? 'absent' : 'present';
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: record.name, phone: record.phone, location: record.location,
          birthday: record.birthday, fellowship: record.fellowship,
          designation: record.designation, firstTimer: record.firstTimer,
          attendanceDate: record.attendanceDate, attendanceStatus: newStatus,
          explicitToggle: true,
        }),
      });
      if (res.ok) {
        setLastSundayRecords(prev => prev.map(r => r.id === record.id ? { ...r, attendanceStatus: newStatus } : r));
      } else {
        setLastSundayMessage({ type: 'error', text: 'Failed to toggle status.' });
      }
    } catch { setLastSundayMessage({ type: 'error', text: 'Network error.' }); }
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

  const pastAttendanceRecords = submittedEntries.filter(
    e => e.attendanceStatus === 'present' && (e.attendanceDate || e.date) === getMostRecentSunday()
  );
  const worksheetMetrics = entryMetrics(entries, markedPresent);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(entry =>
      entry.name.toLowerCase().includes(query) ||
      entry.phone.toLowerCase().includes(query) ||
      entry.location.toLowerCase().includes(query) ||
      entry.fellowship.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

  const rosterPageCount = Math.max(1, Math.ceil(filteredEntries.length / ROSTER_PAGE_SIZE));
  const safeRosterPage = Math.min(rosterPage, rosterPageCount);
  const rosterPageStart = (safeRosterPage - 1) * ROSTER_PAGE_SIZE;
  const visibleEntries = filteredEntries.slice(rosterPageStart, rosterPageStart + ROSTER_PAGE_SIZE);

  useEffect(() => {
    setRosterPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (rosterPage > rosterPageCount) setRosterPage(rosterPageCount);
  }, [rosterPage, rosterPageCount]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed relative"
      style={{ backgroundImage: 'url(/background.jpg)' }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10">
        <Navbar />
        <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-8">

          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 sm:mb-6 p-1 bg-black/30 backdrop-blur-sm rounded-xl w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('entries')}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'entries'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📋 New Entries
            </button>
            <button
              onClick={() => setActiveTab('cell-leaders')}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Mark Attendance</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Active roster: <span className="font-semibold text-gray-900">{isLoadingRoster ? '…' : activeRosterCount ?? 'Unavailable'}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Selected to submit: <span className="font-semibold text-blue-600">{worksheetMetrics.selected}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Saved present for this service: <span className="font-semibold text-green-700">{serviceSummary?.serviceDate === getMostRecentSunday() ? serviceSummary.savedPresent : summaryError ? 'Unavailable' : '…'}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Selections are unsaved until submitted. Saved attendance counts unique people across all submissions, not just this browser.</p>
                  {summaryError && <button type="button" onClick={fetchServiceSummary} className="mt-1 text-xs font-semibold text-blue-700">Retry saved attendance count</button>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" id="excel-upload" />
                  <label htmlFor="excel-upload" className="px-3 sm:px-4 py-2 bg-purple-600 text-white text-center rounded-md hover:bg-purple-700 transition cursor-pointer text-sm">
                    Import Excel
                  </label>
                  <button
                    onClick={() => { fetchMembersForRoster(); fetchServiceSummary(); }}
                    disabled={isLoadingRoster}
                    className="px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    {isLoadingRoster ? 'Loading…' : '👥 Refresh Roster'}
                  </button>
                  <button onClick={addRow} className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm">
                    Add Row
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoadingRoster || worksheetMetrics.selected === 0}
                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    {isSubmitting ? 'Submitting…' : `Submit Present (${worksheetMetrics.selected})`}
                  </button>
                </div>
              </div>

              {message && (
                <DismissibleBanner onDismiss={() => setMessage(null)} role={message.type === 'error' ? 'alert' : 'status'} className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message.text}
                </DismissibleBanner>
              )}

              {rosterRecovery.length > 0 && recoveryKey !== dismissedRecovery && <DismissibleBanner dismissLabel="Dismiss recovery notice" onDismiss={() => {
                setDismissedRecovery(recoveryKey);
                try { sessionStorage.setItem('dismissed-roster-recovery', recoveryKey); } catch {}
              }} className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {rosterRecovery.length} cached roster rows no longer belong to the active roster, for example after merging. They are excluded from attendance selections. Any details from those rows can be recovered here.
                <button type="button" className="ml-2 font-semibold underline" onClick={() => {
                  const url = URL.createObjectURL(new Blob([JSON.stringify(rosterRecovery, null, 2)], { type: 'application/json' }));
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `attendance-roster-recovery-${dateInAccra()}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}>Download old draft details</button>
              </DismissibleBanner>}
              {rosterRecovery.length > 0 && recoveryKey === dismissedRecovery && <button type="button" onClick={() => {
                setDismissedRecovery('');
                try { sessionStorage.removeItem('dismissed-roster-recovery'); } catch {}
              }} className="mb-4 text-xs font-semibold text-amber-800 underline">Show saved recovery details ({rosterRecovery.length})</button>}

              <div className="mb-4 pb-3 border-b border-gray-300">
                <p className="text-lg font-semibold text-gray-700">
                  {(() => {
                    const [y, m, d] = getMostRecentSunday().split('-').map(Number);
                    return formatDate(new Date(y, m - 1, d));
                  })()}
                </p>
                {new Date().getDay() !== 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">Recording for last Sunday (service date)</p>
                )}
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

              <div className="mb-3 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {filteredEntries.length === 0
                    ? 'No matching worksheet rows'
                    : `Showing rows ${rosterPageStart + 1}–${Math.min(rosterPageStart + ROSTER_PAGE_SIZE, filteredEntries.length)} of ${filteredEntries.length}`}
                  <span className="ml-2 text-xs">Worksheet: {worksheetMetrics.people} named rows · {worksheetMetrics.blankRows} blank rows (excluded from selection totals)</span>
                </span>
                {rosterPageCount > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRosterPage(page => Math.max(1, page - 1))}
                      disabled={safeRosterPage === 1}
                      className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="min-w-20 text-center">Page {safeRosterPage} of {rosterPageCount}</span>
                    <button
                      type="button"
                      onClick={() => setRosterPage(page => Math.min(rosterPageCount, page + 1))}
                      disabled={safeRosterPage === rosterPageCount}
                      className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 md:hidden">
                {visibleEntries.map(entry => {
                  const isEditing = editingId === entry.id;
                  const isPresent = markedPresent.has(entry.id);
                  const inputCls = (editing: boolean) =>
                    `w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${!editing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`;

                  return (
                    <article key={entry.id} className={`rounded-xl border p-3 shadow-sm ${isPresent ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input type="text" value={entry.name} onChange={e => handleCellChange(entry.id, 'name', e.target.value)} className={inputCls(true)} placeholder="Full name" />
                          ) : (
                            <>
                              <h2 className="truncate font-semibold text-gray-900">{entry.name || 'New attendee'}</h2>
                              <p className="truncate text-xs text-gray-500">{entry.fellowship || 'Unassigned'} · {entry.designation || 'Member'}</p>
                            </>
                          )}
                        </div>
                        {isPresent && <span className="rounded-full bg-green-600 px-2 py-1 text-xs font-semibold text-white">Present</span>}
                      </div>

                      {isEditing ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input type="tel" value={entry.phone} onChange={e => handleCellChange(entry.id, 'phone', e.target.value)} className={inputCls(true)} placeholder="Phone number" />
                          <input type="text" value={entry.location} onChange={e => handleCellChange(entry.id, 'location', e.target.value)} className={inputCls(true)} placeholder="Location" />
                          <FancyBirthdayPicker value={entry.birthday} onChange={(val: string) => handleCellChange(entry.id, 'birthday', val)} disabled={false} />
                          <select value={entry.fellowship} onChange={e => handleCellChange(entry.id, 'fellowship', e.target.value)} className={inputCls(true)}>
                            <option value="" disabled>Select Fellowship</option>
                            {FELLOWSHIPS.map(f => <option key={f} value={f}>{f}</option>)}
                            {entry.fellowship && !FELLOWSHIPS.includes(entry.fellowship) && <option value={entry.fellowship}>{entry.fellowship}</option>}
                          </select>
                          <select value={entry.designation} onChange={e => handleCellChange(entry.id, 'designation', e.target.value)} className={inputCls(true)}>
                            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                          <div><span className="block text-xs text-gray-500">Contact</span><span className="text-gray-800">{entry.phone || '—'}</span></div>
                          <div><span className="block text-xs text-gray-500">Location</span><span className="text-gray-800">{entry.location || '—'}</span></div>
                          <div><span className="block text-xs text-gray-500">Birthday</span><span className="text-gray-800">{entry.birthday || '—'}</span></div>
                          <div><span className="block text-xs text-gray-500">Visitor check</span><span className="font-medium text-blue-700">Automatic</span></div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
                        {isEditing ? (
                          <>
                            <button onClick={() => setEditingId(null)} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white">Save</button>
                            <button onClick={() => setEditingId(null)} className="rounded-md bg-gray-600 px-3 py-2 text-sm font-medium text-white">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingId(entry.id)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Edit</button>
                            <button onClick={() => handleMarkPresent(entry.id)} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${isPresent ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                              {isPresent ? '✓ Present' : 'Mark Present'}
                            </button>
                          </>
                        )}
                        {entries.length > 1 && !isEditing && (
                          <button onClick={() => removeRow(entry.id)} className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Remove</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      {['NAME', 'CONTACT', 'DATE OF BIRTH', 'LOCATION', 'FELLOWSHIP', 'DESIGNATION', 'VISITOR CHECK', 'ACTIONS'].map(h => (
                        <th key={h} className={`px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-300 last:border-r-0 ${h === 'NAME' ? 'min-w-[200px] sm:min-w-[250px]' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {visibleEntries.map(entry => {
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
                              <FancyBirthdayPicker value={entry.birthday} onChange={(val: string) => handleCellChange(entry.id, 'birthday', val)} disabled={!isEditing} />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input type="text" value={entry.location} onChange={e => handleCellChange(entry.id, 'location', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Location" />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <select value={entry.fellowship} onChange={e => handleCellChange(entry.id, 'fellowship', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)}>
                                <option value="" disabled>Select Fellowship</option>
                                {FELLOWSHIPS.map(f => <option key={f} value={f}>{f}</option>)}
                                {entry.fellowship && !FELLOWSHIPS.includes(entry.fellowship) && <option value={entry.fellowship}>{entry.fellowship}</option>}
                              </select>
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
                            <td className="px-3 py-2 border-r border-gray-300 text-center">
                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700" title="The roster is checked when this attendance is submitted">
                                Automatic
                              </span>
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

              {/* Past Attendance Records */}
              {new Date().getDay() !== 0 && pastAttendanceRecords.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">Past Attendance Records</h2>
                  <div className="mb-4">
                    <input
                      type="text"
                      value={submittedSearchQuery}
                      onChange={e => setSubmittedSearchQuery(e.target.value)}
                      placeholder="Search past attendance records…"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {['NAME', 'CONTACT', 'DATE OF BIRTH', 'LOCATION', 'FELLOWSHIP', 'DESIGNATION', 'STATUS', 'FIRST TIME?'].map(h => (
                            <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider ${h === 'NAME' ? 'min-w-[200px] sm:min-w-[250px]' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pastAttendanceRecords
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

              {/* ── Last Sunday's Records (weekdays only) ──────────────────── */}
              {new Date().getDay() !== 0 && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Last Sunday&apos;s Records</h2>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {(() => {
                          const [y, m, d] = getMostRecentSunday().split('-').map(Number);
                          return formatDate(new Date(y, m - 1, d));
                        })()} — edit or correct submitted entries
                      </p>
                    </div>
                    <button
                      onClick={() => { fetchLastSundayRecords(); setLastSundayMessage(null); }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition text-sm"
                    >↺ Reload</button>
                  </div>

                  {lastSundayMessage && (
                    <DismissibleBanner onDismiss={() => setLastSundayMessage(null)} role={lastSundayMessage.type === 'error' ? 'alert' : 'status'} className={`mb-3 p-3 rounded text-sm ${lastSundayMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {lastSundayMessage.text}
                    </DismissibleBanner>
                  )}

                  <div className="mb-3">
                    <input
                      type="text"
                      value={lastSundaySearch}
                      onChange={e => setLastSundaySearch(e.target.value)}
                      placeholder="Search last Sunday's records…"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {isLoadingLastSunday ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : lastSundayRecords.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No records found for last Sunday.</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {['NAME', 'CONTACT', 'DATE OF BIRTH', 'LOCATION', 'FELLOWSHIP', 'DESIGNATION', 'STATUS', 'ACTIONS'].map(h => (
                                <th key={h} className={`px-3 py-2 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${h === 'NAME' ? 'min-w-[200px] sm:min-w-[250px]' : ''}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {lastSundayRecords
                              .filter(r => {
                                if (!lastSundaySearch.trim()) return true;
                                const q = lastSundaySearch.toLowerCase();
                                return r.name.toLowerCase().includes(q) || r.fellowship.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q);
                              })
                              .map(record => {
                                const isEditing = lastSundayEditingId === record.id;
                                const edits = lastSundayEdits[record.id] || {};
                                const merged = { ...record, ...edits };
                                const isPresent = merged.attendanceStatus === 'present';
                                const inputCls = (editing: boolean) =>
                                  `w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${!editing ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`;
                                return (
                                  <tr key={record.id} className={`hover:bg-gray-50 ${isPresent ? 'bg-green-50' : 'bg-red-50/30'}`}>
                                    <td className="px-3 py-2 border-r border-gray-200 min-w-[130px]">
                                      <input type="text" value={merged.name} onChange={e => handleLastSundayFieldChange(record.id, 'name', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} />
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-200 min-w-[110px]">
                                      <input type="tel" value={merged.phone} onChange={e => handleLastSundayFieldChange(record.id, 'phone', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Phone" />
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-200 min-w-[90px]">
                                      <input type="text" value={merged.birthday} onChange={e => handleLastSundayFieldChange(record.id, 'birthday', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="DD-MM" />
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-200 min-w-[110px]">
                                      <input type="text" value={merged.location} onChange={e => handleLastSundayFieldChange(record.id, 'location', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)} placeholder="Location" />
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-200 min-w-[110px]">
                                      <select value={merged.fellowship} onChange={e => handleLastSundayFieldChange(record.id, 'fellowship', e.target.value)} disabled={!isEditing} className={inputCls(isEditing)}>
                                        <option value="" disabled>Select Fellowship</option>
                                        {FELLOWSHIPS.map(f => <option key={f} value={f}>{f}</option>)}
                                        {merged.fellowship && !FELLOWSHIPS.includes(merged.fellowship) && <option value={merged.fellowship}>{merged.fellowship}</option>}
                                      </select>
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-200 min-w-[130px]">
                                      {isEditing ? (
                                        <select value={merged.designation} onChange={e => handleLastSundayFieldChange(record.id, 'designation', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white">
                                          {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                      ) : (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${designationColors[merged.designation] || designationColors['Member']}`}>{merged.designation}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-200">
                                      <button
                                        onClick={() => toggleLastSundayStatus(record)}
                                        className={`px-3 py-1 text-xs rounded-full font-semibold transition whitespace-nowrap ${isPresent ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                      >
                                        {isPresent ? '✓ Present' : '✗ Absent'}
                                      </button>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1">
                                        {isEditing ? (
                                          <>
                                            <button onClick={() => handleLastSundaySave(record)} disabled={isSavingLastSunday} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50">Save</button>
                                            <button onClick={() => { setLastSundayEditingId(null); setLastSundayEdits(prev => { const n = { ...prev }; delete n[record.id]; return n; }); }} className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition">Cancel</button>
                                          </>
                                        ) : (
                                          <button onClick={() => setLastSundayEditingId(record.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition">Edit</button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{lastSundayRecords.length} record(s) for last Sunday</p>
                    </>
                  )}
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
                    <p className="text-sm text-gray-500 mt-1">
                      {(() => {
                        const [y, m, d] = getMostRecentSunday().split('-').map(Number);
                        return formatDate(new Date(y, m - 1, d));
                      })()} — Tap a name to mark present
                    </p>
                    {new Date().getDay() !== 0 && (
                      <p className="text-xs text-amber-600">Recording for last Sunday (service date)</p>
                    )}
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
                    <span className="text-sm font-medium text-gray-700">Selected present: <strong className="text-green-600">{clPresentCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-sm font-medium text-gray-700">Not selected: <strong className="text-red-600">{clAbsentCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Visible leaders: <strong>{filteredCellLeaders.length}</strong></span>
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
                <DismissibleBanner onDismiss={() => setClMessage(null)} role={clMessage.type === 'error' ? 'alert' : 'status'} className={`p-4 rounded-xl ${clMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {clMessage.text}
                </DismissibleBanner>
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
                          {isPresent ? 'Selected present' : 'Not selected'}
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
                  <div className="text-green-700 font-medium text-sm">✓ Attendance recorded for the displayed service date</div>
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
