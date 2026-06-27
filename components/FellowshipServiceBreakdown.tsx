'use client';

import { useState, useEffect } from 'react';

interface FellowshipCount {
  present: number;
  total: number;
  rate: number;
}

interface ServiceRow {
  date: string;
  label: string;
  fellowships: Record<string, FellowshipCount>;
  totalPresent: number;
  totalAttendees: number;
  overallRate: number;
}

interface ApiResponse {
  services: ServiceRow[];
  fellowships: string[];
}

const FELLOWSHIP_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', bar: 'bg-violet-500' },
  { bg: 'bg-blue-100',   text: 'text-blue-700',   bar: 'bg-blue-500'   },
  { bg: 'bg-teal-100',   text: 'text-teal-700',   bar: 'bg-teal-500'   },
  { bg: 'bg-emerald-100',text: 'text-emerald-700', bar: 'bg-emerald-500'},
  { bg: 'bg-amber-100',  text: 'text-amber-700',  bar: 'bg-amber-500'  },
  { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   bar: 'bg-rose-500'   },
  { bg: 'bg-pink-100',   text: 'text-pink-700',   bar: 'bg-pink-500'   },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', bar: 'bg-indigo-500' },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',   bar: 'bg-cyan-500'   },
  { bg: 'bg-lime-100',   text: 'text-lime-700',   bar: 'bg-lime-500'   },
  { bg: 'bg-gray-100',   text: 'text-gray-700',   bar: 'bg-gray-400'   },
];

const rateColor = (rate: number) => {
  if (rate >= 75) return 'text-green-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-500';
};

const rateBarColor = (rate: number) => {
  if (rate >= 75) return 'bg-green-500';
  if (rate >= 50) return 'bg-amber-400';
  return 'bg-red-400';
};

type ViewMode = 'table' | 'cards';
type MetricMode = 'present' | 'rate';

export default function FellowshipServiceBreakdown() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [metric, setMetric] = useState<MetricMode>('present');
  const [activeFellowships, setActiveFellowships] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/analytics/fellowship-per-service')
      .then(r => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setActiveFellowships(new Set(d.fellowships));
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-40 mb-3" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-12 bg-gray-100 rounded-lg flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.services.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="text-5xl mb-4">📅</div>
        <p className="text-gray-500">No service data recorded yet.</p>
      </div>
    );
  }

  const colorMap: Record<string, (typeof FELLOWSHIP_COLORS)[number]> = {};
  data.fellowships.forEach((f, i) => {
    colorMap[f] = FELLOWSHIP_COLORS[i % FELLOWSHIP_COLORS.length];
  });

  const visibleFellowships = data.fellowships.filter(f => activeFellowships.has(f));

  // Show most recent services first
  const services = [...data.services].reverse();

  const toggleFellowship = (f: string) => {
    setActiveFellowships(prev => {
      const next = new Set(prev);
      if (next.has(f)) {
        if (next.size > 1) next.delete(f); // keep at least one
      } else {
        next.add(f);
      }
      return next;
    });
  };

  // Summary stats
  const totalServices = data.services.length;
  const grandTotalPresent = data.services.reduce((s, r) => s + r.totalPresent, 0);
  const grandTotalRecords = data.services.reduce((s, r) => s + r.totalAttendees, 0);
  const avgRate = grandTotalRecords > 0 ? Math.round((grandTotalPresent / grandTotalRecords) * 100) : 0;
  const bestService = [...data.services].sort((a, b) => b.totalPresent - a.totalPresent)[0];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Services Recorded', value: totalServices, icon: '📅', color: 'text-blue-600' },
          { label: 'Total Present', value: grandTotalPresent, icon: '✅', color: 'text-green-600' },
          { label: 'Overall Rate', value: `${avgRate}%`, icon: '📊', color: rateColor(avgRate) },
          { label: 'Best Attendance', value: bestService ? bestService.totalPresent : '—', icon: '🏆', color: 'text-amber-600' },
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

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* View toggle */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500 font-medium">View:</span>
          {(['cards', 'table'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                viewMode === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {v === 'cards' ? '🗂 Cards' : '📋 Table'}
            </button>
          ))}
          <span className="mx-1 text-gray-300">|</span>
          <span className="text-sm text-gray-500 font-medium">Show:</span>
          {(['present', 'rate'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                metric === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m === 'present' ? '# Present' : '% Rate'}
            </button>
          ))}
        </div>

        {/* Fellowship filter pills */}
        <div className="flex flex-wrap gap-2">
          {data.fellowships.map(f => {
            const c = colorMap[f];
            const active = activeFellowships.has(f);
            return (
              <button
                key={f}
                onClick={() => toggleFellowship(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  active
                    ? `${c.bg} ${c.text} border-transparent`
                    : 'bg-white text-gray-400 border-gray-200 line-through'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50 z-10">
                    Service Date
                  </th>
                  {visibleFellowships.map(f => (
                    <th
                      key={f}
                      className={`text-center px-3 py-3 font-semibold whitespace-nowrap ${colorMap[f].text}`}
                    >
                      {f}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {services.map((row, i) => (
                  <tr key={row.date} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-inherit z-10">
                      {row.label}
                    </td>
                    {visibleFellowships.map(f => {
                      const entry = row.fellowships[f];
                      const val = metric === 'present' ? (entry?.present ?? 0) : (entry?.rate ?? 0);
                      const hasData = (entry?.total ?? 0) > 0;
                      return (
                        <td key={f} className="px-3 py-3 text-center">
                          {hasData ? (
                            <span className={`font-semibold ${metric === 'rate' ? rateColor(entry.rate) : 'text-gray-800'}`}>
                              {metric === 'present' ? val : `${val}%`}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-bold text-gray-800">
                      {row.totalPresent}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${rateColor(row.overallRate)}`}>
                      {row.overallRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards view */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {services.map(row => (
            <div
              key={row.date}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Service header */}
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{row.label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {row.totalAttendees} records · {row.totalPresent} present
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Overall Rate</p>
                    <p className={`text-xl font-bold ${rateColor(row.overallRate)}`}>
                      {row.overallRate}%
                    </p>
                  </div>
                  {/* Mini overall bar */}
                  <div className="w-2 h-12 bg-gray-100 rounded-full overflow-hidden flex flex-col justify-end">
                    <div
                      className={`w-full rounded-full transition-all duration-500 ${rateBarColor(row.overallRate)}`}
                      style={{ height: `${row.overallRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Fellowship grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {visibleFellowships.map(f => {
                  const entry = row.fellowships[f];
                  const hasData = (entry?.total ?? 0) > 0;
                  const c = colorMap[f];

                  return (
                    <div
                      key={f}
                      className={`rounded-lg p-3 ${hasData ? c.bg : 'bg-gray-50'}`}
                    >
                      <p className={`text-xs font-semibold truncate mb-1.5 ${hasData ? c.text : 'text-gray-300'}`}>
                        {f}
                      </p>
                      {hasData ? (
                        <>
                          <p className={`text-xl font-bold ${c.text}`}>
                            {metric === 'present' ? entry.present : `${entry.rate}%`}
                          </p>
                          {metric === 'present' && (
                            <p className="text-xs text-gray-500 mt-0.5">/ {entry.total}</p>
                          )}
                          {/* Bar */}
                          <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
                              style={{ width: `${entry.rate}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-gray-300">—</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
