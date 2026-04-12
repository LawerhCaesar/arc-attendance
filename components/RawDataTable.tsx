'use client';

import { useState, useEffect, useCallback } from 'react';

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

export default function RawDataTable() {
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fellowshipFilter, setFellowshipFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) setData(await res.json());
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fellowships = Array.from(new Set(data.map(r => r.fellowship).filter(Boolean))).sort();

  const filtered = data.filter(row => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      row.name.toLowerCase().includes(q) ||
      row.phone.includes(q) ||
      row.fellowship.toLowerCase().includes(q) ||
      row.location.toLowerCase().includes(q);
    const matchFellowship = fellowshipFilter === 'all' || row.fellowship === fellowshipFilter;
    const matchDesignation = designationFilter === 'all' || row.designation === designationFilter;
    const matchStatus = statusFilter === 'all' || row.attendanceStatus === statusFilter;
    const matchDateFrom = !dateFrom || (row.attendanceDate || '') >= dateFrom;
    const matchDateTo = !dateTo || (row.attendanceDate || '') <= dateTo;
    return matchSearch && matchFellowship && matchDesignation && matchStatus && matchDateFrom && matchDateTo;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, fellowshipFilter, designationFilter, statusFilter, dateFrom, dateTo]);

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
    a.download = `attendance-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, fellowship, or location…"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleExport}
            className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition whitespace-nowrap"
          >
            ↓ Export CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={fellowshipFilter}
            onChange={e => setFellowshipFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Fellowships</option>
            {fellowships.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={designationFilter}
            onChange={e => setDesignationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DESIGNATIONS.map(d => <option key={d} value={d === 'All' ? 'all' : d}>{d}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="From date"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="To date"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(search || fellowshipFilter !== 'all' || designationFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setFellowshipFilter('all'); setDesignationFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} records (total: {data.length})
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🗃️</div>
          <p className="text-gray-500">No records match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Name', 'Phone', 'Fellowship', 'Designation', 'Location', 'Birthday', 'Status', 'First Timer'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {row.attendanceDate
                          ? new Date(row.attendanceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-sm text-gray-900 whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.phone || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.fellowship || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${designationColors[row.designation || 'Member'] || designationColors['Member']}`}>
                          {row.designation || 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.location || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.birthday || '—'}</td>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
