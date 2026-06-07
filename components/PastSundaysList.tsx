'use client';

import { useState, useEffect, useCallback } from 'react';
import { FELLOWSHIPS } from '@/lib/fellowships';

interface AttendanceRow {
  id: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  designation: string;
  firstTimer: boolean;
  attendanceDate?: string;
  attendanceStatus?: string;
}

const DESIGNATIONS = ['All', 'Fellowship Leader', 'Cell Leader', 'BSCT Leader', 'Member'] as const;

const getTargetSundays = () => {
  const sundays = [];
  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, 0, 1); 
  
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }

  while (date.getFullYear() === currentYear) {
    sundays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  
  return sundays.reverse(); // Newest first
};

const formatDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (date: Date): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const getOrdinal = (n: number) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1:  return 'st';
      case 2:  return 'nd';
      case 3:  return 'rd';
      default: return 'th';
    }
  };
  return `${dayName}, ${day}${getOrdinal(day)} ${month}, ${year}`;
};

const statusBadge = (status?: string) => {
  if (status === 'present') return 'bg-green-100 text-green-700';
  if (status === 'absent') return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-500';
};

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-700',
  'Cell Leader': 'bg-blue-100 text-blue-700',
  'BSCT Leader': 'bg-amber-100 text-amber-700',
  'Member': 'bg-gray-100 text-gray-600',
};

export default function PastSundaysList() {
  const [sundays] = useState(() => getTargetSundays());
  
  // Find the most recent Sunday that is on or before today
  const defaultSunday = sundays.find(d => d <= new Date()) || sundays[0];
  
  const [selectedDate, setSelectedDate] = useState<string>(formatDateIso(defaultSunday));
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fellowshipFilter, setFellowshipFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async (dateIso: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/attendance/by-date?date=${dateIso}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData([]);
      }
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchData(selectedDate);
    }
  }, [selectedDate, fetchData]);

  const fellowships = [...FELLOWSHIPS, 'Unassigned'].sort();

  const filtered = data.filter(row => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      row.name.toLowerCase().includes(q) ||
      row.phone.includes(q) ||
      (row.fellowship && row.fellowship.toLowerCase().includes(q)) ||
      (row.location && row.location.toLowerCase().includes(q));
    const matchFellowship = fellowshipFilter === 'all' || row.fellowship === fellowshipFilter;
    const matchDesignation = designationFilter === 'all' || row.designation === designationFilter;
    const matchStatus = statusFilter === 'all' || row.attendanceStatus === statusFilter;
    return matchSearch && matchFellowship && matchDesignation && matchStatus;
  });

  const handleExport = () => {
    const headers = ['Name', 'Phone', 'Fellowship', 'Designation', 'Location', 'Birthday', 'First Timer', 'Date', 'Status'];
    const rows = filtered.map(r => [
      r.name, r.phone, r.fellowship, r.designation || 'Member',
      r.location, r.birthday, r.firstTimer ? 'Yes' : 'No',
      r.attendanceDate || '', r.attendanceStatus || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-100 pb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Past Sundays Attendance</h2>
            <p className="text-gray-500 text-sm mt-1">View the full attendance roster for any past Sunday.</p>
          </div>
          
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Sunday</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full rounded-lg border-gray-300 py-2 pl-3 pr-10 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm bg-gray-50 border shadow-sm min-w-[250px]"
            >
              {sundays.map(date => {
                const iso = formatDateIso(date);
                const display = formatDateDisplay(date);
                const isFuture = date > new Date();
                return (
                  <option key={iso} value={iso} disabled={isFuture}>
                    {display} {isFuture ? '(Future)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, fellowship, or location…"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition whitespace-nowrap disabled:opacity-50"
            >
              ↓ Export CSV
            </button>
            <button
              onClick={() => fetchData(selectedDate)}
              className="px-5 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition whitespace-nowrap"
            >
              ↺ Reload
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={fellowshipFilter}
              onChange={e => setFellowshipFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Fellowships</option>
              {fellowships.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              value={designationFilter}
              onChange={e => setDesignationFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DESIGNATIONS.map(d => <option key={d} value={d === 'All' ? 'all' : d}>{d}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
            
            {(search || fellowshipFilter !== 'all' || designationFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setFellowshipFilter('all'); setDesignationFilter('all'); setStatusFilter('all'); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-gray-500 font-medium">No records found for this Sunday.</p>
          <p className="text-sm text-gray-400 mt-1">If attendance wasn't taken, there will be no records here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-500 font-medium">No records match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filtered.length}</span> out of {data.length} total records
            </div>
            <div className="text-sm text-gray-600">
              Present: <span className="font-semibold text-green-600">{filtered.filter(r => r.attendanceStatus === 'present').length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Phone', 'Fellowship', 'Designation', 'Location', 'Status', 'First Timer'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-sm text-gray-900 whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.fellowship || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${designationColors[row.designation || 'Member'] || designationColors['Member']}`}>
                        {row.designation || 'Member'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.location || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge(row.attendanceStatus)}`}>
                        {row.attendanceStatus || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.firstTimer ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {row.firstTimer ? 'Yes' : 'No'}
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
  );
}
