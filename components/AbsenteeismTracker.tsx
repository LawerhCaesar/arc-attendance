'use client';

import { useState, useEffect, useMemo } from 'react';

// Definitions
interface Member {
  id: string;
  name: string;
  phone: string;
  fellowship: string;
}

interface AttendanceRecord {
  name: string;
  attendanceDate: string; // ISO date YYYY-MM-DD
  attendanceStatus: string; // 'present' | 'absent'
}

interface TrackerRow {
  member: Member;
  totalAbsences: number;
  monthlyAbsences: number;
  consecutiveAbsences: number;
  lastAttended: string | null; // ISO Date
  daysSinceLastAttended: number | null;
  needsFlag: boolean;
}

// Helper
const getDaysDiff = (date1: string, date2: string) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export default function AbsenteeismTracker() {
  const [members, setMembers] = useState<Member[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Sorting
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM
  const [sortField, setSortField] = useState<keyof TrackerRow>('totalAbsences');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [memRes, attRes] = await Promise.all([
          fetch('/api/members'),
          fetch('/api/attendance')
        ]);
        if (memRes.ok) setMembers(await memRes.json());
        if (attRes.ok) setRecords(await attRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const serviceDates = useMemo(() => {
    const dates = new Set<string>();
    records.forEach(r => {
      if (r.attendanceDate) dates.add(r.attendanceDate);
    });
    return Array.from(dates).sort(); // Ascending
  }, [records]);

  // Available months for selector
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    serviceDates.forEach(d => months.add(d.substring(0, 7))); // YYYY-MM
    return Array.from(months).sort().reverse(); // Newest first
  }, [serviceDates]);

  // Set default month
  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const trackerData = useMemo(() => {
    const data: TrackerRow[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    members.forEach(member => {
      // Find all records for this member
      const memberRecords = records.filter(r => r.name.toLowerCase() === member.name.toLowerCase());
      
      let totalAbsences = 0;
      let monthlyAbsences = 0;
      let consecutiveAbsences = 0;
      let lastAttended: string | null = null;
      let isConsecutiveBroken = false;

      // Analyze dates from newest to oldest
      const sortedDates = [...serviceDates].reverse();

      sortedDates.forEach(date => {
        const record = memberRecords.find(r => r.attendanceDate === date);
        const isPresent = record?.attendanceStatus === 'present';
        const isAbsent = !isPresent; // Implicitly absent if no record, or explicitly absent

        // Update last attended
        if (isPresent && !lastAttended) {
          lastAttended = date;
        }

        // Consecutive absences
        if (isAbsent && !isConsecutiveBroken) {
          consecutiveAbsences++;
        } else if (isPresent) {
          isConsecutiveBroken = true;
        }

        // Total
        if (isAbsent) totalAbsences++;

        // Monthly
        if (isAbsent && date.startsWith(selectedMonth)) {
          monthlyAbsences++;
        }
      });

      const daysSinceLastAttended = lastAttended ? getDaysDiff(lastAttended, todayStr) : null;
      
      // If never attended, the diff is since the first recorded service
      const noAttendDiff = serviceDates.length > 0 ? getDaysDiff(serviceDates[0], todayStr) : null;
      const actualDiff = daysSinceLastAttended ?? noAttendDiff;

      const needsFlag = actualDiff !== null && actualDiff > 30;

      data.push({
        member,
        totalAbsences,
        monthlyAbsences,
        consecutiveAbsences,
        lastAttended,
        daysSinceLastAttended: actualDiff,
        needsFlag
      });
    });

    return data;
  }, [members, records, serviceDates, selectedMonth]);

  const sortedData = useMemo(() => {
    const sorted = [...trackerData].filter(row => {
      const q = searchQuery.toLowerCase();
      return row.member.name.toLowerCase().includes(q) || (row.member.fellowship || '').toLowerCase().includes(q);
    });

    sorted.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      
      if (sortField === 'member') {
        valA = a.member.name;
        valB = b.member.name;
      }

      if (valA === null) valA = 9999; // Put never-attended at top of descending
      if (valB === null) valB = 9999;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [trackerData, sortField, sortOrder, searchQuery]);

  const handleSort = (field: keyof TrackerRow) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for metrics
    }
  };

  // KPIs
  const flaggedCount = trackerData.filter(d => d.needsFlag).length;
  const avgMonthly = trackerData.length ? (trackerData.reduce((acc, curr) => acc + curr.monthlyAbsences, 0) / trackerData.length).toFixed(1) : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm">
          <div className="text-red-800 text-sm font-semibold mb-1">MIA &gt; 30 Days</div>
          <div className="text-3xl font-bold text-red-600">{flaggedCount}</div>
          <div className="text-red-600 text-xs mt-1">Members needing follow-up</div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="text-gray-500 text-sm font-semibold mb-1">Total Members Tracked</div>
          <div className="text-3xl font-bold text-gray-800">{trackerData.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="text-gray-500 text-sm font-semibold mb-1">Avg Absences ({selectedMonth || 'Any'})</div>
          <div className="text-3xl font-bold text-blue-600">{avgMonthly}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <input 
          type="text" 
          placeholder="Search member or fellowship..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-full md:w-64 focus:ring-blue-500 focus:border-blue-500"
        />
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Month:</span>
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('member')}>
                  Member {sortField === 'member' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalAbsences')}>
                  Total Absences {sortField === 'totalAbsences' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('consecutiveAbsences')}>
                  Consecutive {sortField === 'consecutiveAbsences' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('monthlyAbsences')}>
                  {selectedMonth || 'Monthly'} Absences {sortField === 'monthlyAbsences' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('daysSinceLastAttended')}>
                  Last Seen {sortField === 'daysSinceLastAttended' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((row) => (
                <tr key={row.member.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">{row.member.name}</div>
                      {row.needsFlag && (
                        <span className="text-red-500" title="Has not attended in > 30 days">🚨</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{row.member.fellowship || 'No Fellowship'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {row.totalAbsences}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.consecutiveAbsences > 0 ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.consecutiveAbsences >= 3 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        {row.consecutiveAbsences} in a row
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.monthlyAbsences}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.lastAttended ? (
                      <div>
                        <div>{row.lastAttended}</div>
                        <div className={`text-xs ${row.needsFlag ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                          {row.daysSinceLastAttended} days ago
                        </div>
                      </div>
                    ) : (
                      <span className="text-red-600 font-medium">Never attended</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
