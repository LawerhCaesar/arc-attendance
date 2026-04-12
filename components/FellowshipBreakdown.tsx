'use client';

import { useState, useEffect } from 'react';

interface FellowshipData {
  name: string;
  total: number;
  present: number;
  absent: number;
  attendanceRate: number;
  uniquePersons: number;
  totalServices: number;
  recentDate: string;
  designations: Record<string, number>;
}

interface FellowshipResponse {
  fellowships: FellowshipData[];
  totalFellowships: number;
}

const designationColors: Record<string, string> = {
  'Fellowship Leader': 'bg-purple-100 text-purple-700',
  'Cell Leader': 'bg-blue-100 text-blue-700',
  'BSCT Leader': 'bg-amber-100 text-amber-700',
  'Member': 'bg-gray-100 text-gray-600',
};

const rateColor = (rate: number) => {
  if (rate >= 75) return 'text-green-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-600';
};

const rateBarColor = (rate: number) => {
  if (rate >= 75) return 'bg-green-500';
  if (rate >= 50) return 'bg-amber-400';
  return 'bg-red-400';
};

export default function FellowshipBreakdown() {
  const [data, setData] = useState<FellowshipResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'total' | 'rate' | 'name'>('total');

  useEffect(() => {
    fetch('/api/analytics/fellowship')
      .then(r => r.json())
      .then(d => { setData(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-5 bg-gray-200 rounded w-16" />
            </div>
            <div className="mt-4 h-2 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.fellowships.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="text-5xl mb-4">🏛️</div>
        <p className="text-gray-500">No fellowship data available yet.</p>
      </div>
    );
  }

  const sorted = [...data.fellowships].sort((a, b) => {
    if (sortBy === 'rate') return b.attendanceRate - a.attendanceRate;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b.total - a.total;
  });

  // Summary totals
  const totalPresent = data.fellowships.reduce((s, f) => s + f.present, 0);
  const totalAbsent = data.fellowships.reduce((s, f) => s + f.absent, 0);
  const overallRate = (totalPresent + totalAbsent) > 0
    ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Fellowships', value: data.totalFellowships, icon: '🏛️', color: 'text-blue-600' },
          { label: 'Total Records', value: totalPresent + totalAbsent, icon: '📝', color: 'text-gray-700' },
          { label: 'Overall Present', value: totalPresent, icon: '✅', color: 'text-green-600' },
          { label: 'Overall Rate', value: `${overallRate}%`, icon: '📊', color: rateColor(overallRate) },
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

      {/* Sort controls */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-gray-500">Sort by:</span>
        {(['total', 'rate', 'name'] as const).map(opt => (
          <button
            key={opt}
            onClick={() => setSortBy(opt)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              sortBy === opt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt === 'total' ? 'Records' : opt === 'rate' ? 'Rate %' : 'Name'}
          </button>
        ))}
      </div>

      {/* Fellowship cards */}
      <div className="space-y-3">
        {sorted.map(f => {
          const isExpanded = expanded === f.name;
          const designationEntries = Object.entries(f.designations).sort((a, b) => b[1] - a[1]);

          return (
            <div
              key={f.name}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main row */}
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : f.name)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Name & meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{f.name.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{f.name}</h3>
                        <p className="text-xs text-gray-500">
                          {f.uniquePersons} members · {f.totalServices} service{f.totalServices !== 1 ? 's' : ''}
                          {f.recentDate && ` · Last: ${new Date(f.recentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Present</p>
                      <p className="text-lg font-bold text-green-600">{f.present}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Absent</p>
                      <p className="text-lg font-bold text-red-500">{f.absent}</p>
                    </div>
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-gray-500">Rate</p>
                      <p className={`text-lg font-bold ${rateColor(f.attendanceRate)}`}>{f.attendanceRate}%</p>
                    </div>
                    <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${rateBarColor(f.attendanceRate)}`}
                    style={{ width: `${f.attendanceRate}%` }}
                  />
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Designation Breakdown</h4>
                  <div className="flex flex-wrap gap-2">
                    {designationEntries.length > 0 ? designationEntries.map(([designation, count]) => (
                      <div
                        key={designation}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${designationColors[designation] || designationColors['Member']}`}
                      >
                        <span className="font-medium">{designation}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-400">No designation data available</p>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Total Records</p>
                      <p className="font-semibold text-gray-800">{f.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Unique Members</p>
                      <p className="font-semibold text-gray-800">{f.uniquePersons}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Services Tracked</p>
                      <p className="font-semibold text-gray-800">{f.totalServices}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
