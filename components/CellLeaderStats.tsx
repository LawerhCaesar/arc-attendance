'use client';

import { useState, useEffect } from 'react';

interface CellLeaderStat {
  name: string;
  fellowship: string;
  present: number;
  total: number;
  attendanceRate: number;
  lastPresent: string;
}

interface FellowshipResponse {
  cellLeaders: CellLeaderStat[];
}

const rateColor = (r: number) => r >= 75 ? 'text-green-600' : r >= 50 ? 'text-amber-600' : 'text-red-600';
const rateBar = (r: number) => r >= 75 ? 'bg-green-500' : r >= 50 ? 'bg-amber-400' : 'bg-red-400';
const rateBadge = (r: number) =>
  r >= 75 ? 'bg-green-100 text-green-700' : r >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';

export default function CellLeaderStats() {
  const [leaders, setLeaders] = useState<CellLeaderStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fellowshipFilter, setFellowshipFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'rate' | 'name' | 'fellowship' | 'last'>('rate');

  useEffect(() => {
    fetch('/api/analytics/fellowship')
      .then(r => r.json())
      .then((d: FellowshipResponse) => {
        setLeaders(d.cellLeaders || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const fellowships = Array.from(new Set(leaders.map(l => l.fellowship))).sort();

  const filtered = leaders
    .filter(l => {
      const matchFellowship = fellowshipFilter === 'all' || l.fellowship === fellowshipFilter;
      const matchSearch = !search.trim() ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.fellowship.toLowerCase().includes(search.toLowerCase());
      return matchFellowship && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'rate') return b.attendanceRate - a.attendanceRate;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'fellowship') return a.fellowship.localeCompare(b.fellowship);
      if (sortBy === 'last') {
        if (!a.lastPresent && !b.lastPresent) return 0;
        if (!a.lastPresent) return 1;
        if (!b.lastPresent) return -1;
        return new Date(b.lastPresent).getTime() - new Date(a.lastPresent).getTime();
      }
      return 0;
    });

  const avgRate = filtered.length > 0
    ? Math.round(filtered.reduce((s, l) => s + l.attendanceRate, 0) / filtered.length)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (leaders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-gray-600 font-medium">No Cell Leader attendance data yet</p>
        <p className="text-sm text-gray-400 mt-2">
          Record attendance using Cell Leader Check-In on the Entry page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Cell Leaders', value: leaders.length, icon: '👥', color: 'text-blue-600' },
          { label: 'Filtered', value: filtered.length, icon: '🔍', color: 'text-gray-700' },
          { label: 'Avg Attendance Rate', value: `${avgRate}%`, icon: '📊', color: rateColor(avgRate) },
          {
            label: '≥75% Rate',
            value: filtered.filter(l => l.attendanceRate >= 75).length,
            icon: '✅',
            color: 'text-green-600',
          },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cell leaders…"
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={fellowshipFilter}
          onChange={e => setFellowshipFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Fellowships</option>
          {fellowships.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex gap-1">
          {(['rate', 'name', 'fellowship', 'last'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                sortBy === opt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt === 'rate' ? '%' : opt === 'last' ? 'Recent' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No results found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Fellowship', 'Present', 'Total', 'Rate', 'Last Present'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((leader, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                          leader.attendanceRate >= 75 ? 'bg-green-500' : leader.attendanceRate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                        }`}>
                          {leader.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{leader.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600 bg-blue-50 px-2 py-0.5 rounded-md">{leader.fellowship || '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-green-600">{leader.present}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{leader.total}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rateBar(leader.attendanceRate)}`}
                            style={{ width: `${leader.attendanceRate}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${rateColor(leader.attendanceRate)}`}>
                          {leader.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {leader.lastPresent
                        ? new Date(leader.lastPresent).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
