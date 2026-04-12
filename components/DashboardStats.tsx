'use client';

import { useState, useEffect } from 'react';

interface SummaryData {
  totalAttendance: number;
  uniqueVisitors: number;
  repeatVisitors: number;
  totalServices: number;
  latestDate: string;
  latestAttendance: number;
  averageAttendance: number;
}

interface FellowshipSummary {
  totalFellowships: number;
}

const statColorMap = [
  { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-500' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-500' },
  { bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-500' },
  { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-500' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-500' },
  { bg: 'bg-pink-500', light: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-500' },
  { bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-500' },
];

export default function DashboardStats() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [fellowshipCount, setFellowshipCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics/summary').then(r => r.json()),
      fetch('/api/analytics/fellowship').then(r => r.json()),
    ])
      .then(([summary, fellowship]) => {
        setData(summary);
        setFellowshipCount(fellowship.totalFellowships ?? null);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return <div className="text-red-500 mb-6">Failed to load statistics</div>;
  }

  const stats = [
    { label: 'Total Attendance', value: data.totalAttendance.toLocaleString(), icon: '📈' },
    { label: 'Unique Visitors', value: data.uniqueVisitors.toLocaleString(), icon: '👤' },
    { label: 'Repeat Visitors', value: data.repeatVisitors.toLocaleString(), icon: '🔄' },
    { label: 'Total Services', value: data.totalServices.toLocaleString(), icon: '⛪' },
    { label: 'Latest Service', value: data.latestAttendance.toLocaleString(), icon: '📅', subtitle: data.latestDate ? new Date(data.latestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '' },
    { label: 'Avg per Service', value: data.averageAttendance.toLocaleString(), icon: '📊' },
    { label: 'Fellowships', value: fellowshipCount !== null ? String(fellowshipCount) : '—', icon: '🏛️' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
      {stats.map((stat, i) => {
        const colors = statColorMap[i % statColorMap.length];
        return (
          <div
            key={i}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-t-4 ${colors.border} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{stat.value}</p>
                {stat.subtitle && <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>}
              </div>
              <span className="text-xl">{stat.icon}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
