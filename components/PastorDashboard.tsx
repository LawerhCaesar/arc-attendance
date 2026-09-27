'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PastoralDashboardData } from '@/lib/pastoral-dashboard';

type Destination = 'absenteeism' | 'demographics' | 'first-timers' | 'members';

interface PastorDashboardProps {
  onNavigate: (destination: Destination) => void;
  initialData?: PastoralDashboardData;
}

const formatServiceDate = (value: string | null) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  : 'No service recorded yet';

const formatShortDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short',
});

const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">{children}</div>;
}

function LoadingState() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-2xl bg-gray-200" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-gray-200" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 rounded-2xl bg-gray-200" />
        <div className="h-96 rounded-2xl bg-gray-200" />
      </div>
    </div>
  );
}

export default function PastorDashboard({ onNavigate, initialData }: PastorDashboardProps) {
  const [data, setData] = useState<PastoralDashboardData | null>(initialData || null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(!initialData);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/analytics/pastoral-dashboard');
      if (!response.ok) throw new Error('Unable to load dashboard');
      setData(await response.json());
    } catch {
      setError('The pastoral overview could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) loadDashboard();
  }, [initialData, loadDashboard]);

  if (isLoading) return <LoadingState />;
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-gray-900">Pastoral overview unavailable</p>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <button onClick={loadDashboard} className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          Try again
        </button>
      </div>
    );
  }

  const { latestService, care, fellowships, dataQuality } = data;
  const urgentCount = care.absentMembers.length + care.recentFirstTimers.filter(person => !person.hasReturned).length;
  const qualityIssues = dataQuality.missingPhone + dataQuality.missingBirthday + dataQuality.unassignedFellowship;
  const change = latestService.changePercent;

  const stats = [
    {
      label: 'Latest attendance',
      value: latestService.attendance,
      helper: latestService.date && latestService.attendance === 0
        ? 'No one marked present for this service yet'
        : change === null ? 'No previous service' : `${change >= 0 ? '+' : ''}${change}% vs previous`,
      accent: 'border-blue-500',
      valueColor: 'text-blue-700',
    },
    {
      label: 'Member attendance',
      value: `${latestService.memberAttendanceRate}%`,
      helper: `${latestService.activeMembers} active brethren`,
      accent: 'border-emerald-500',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'First timers',
      value: latestService.firstTimers,
      helper: `${latestService.returningVisitors} visitors returned`,
      accent: 'border-violet-500',
      valueColor: 'text-violet-700',
    },
    {
      label: 'Needs attention',
      value: urgentCount,
      helper: `${care.upcomingBirthdays.length} birthdays in 14 days`,
      accent: 'border-amber-500',
      valueColor: 'text-amber-700',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 text-white shadow-lg">
        <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Pastoral overview</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Your church at a glance</h2>
            <p className="mt-2 text-sm text-blue-100">Latest service · {formatServiceDate(latestService.date)}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              See the people behind the attendance numbers, respond to follow-up needs, and celebrate important moments.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/entry" className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-blue-50">
              Mark attendance
            </a>
            <button onClick={() => onNavigate('members')} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">
              Find a person
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(stat => (
          <div key={stat.label} className={`rounded-2xl border border-gray-100 border-t-4 ${stat.accent} bg-white p-4 sm:p-5 shadow-sm`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
            <p className={`mt-2 text-3xl font-bold ${stat.valueColor}`}>{stat.value}</p>
            <p className="mt-1 text-xs text-gray-500">{stat.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="font-bold text-gray-900">People needing attention</h3>
              <p className="mt-0.5 text-xs text-gray-500">Prioritized from recent attendance and first-timer activity</p>
            </div>
            <button onClick={() => onNavigate('absenteeism')} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all</button>
          </div>

          <div className="grid md:grid-cols-2 divide-y md:divide-x md:divide-y-0 divide-gray-100">
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Repeated absences</h4>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{care.absentMembers.length}</span>
              </div>
              {care.absentMembers.length === 0 ? <EmptyState>No repeated absences are currently flagged.</EmptyState> : (
                <div className="space-y-2">
                  {care.absentMembers.slice(0, 5).map(person => (
                    <div key={`${person.id || person.name}-${person.fellowship}`} className="flex items-center justify-between gap-3 rounded-xl bg-red-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{person.name}</p>
                        <p className="truncate text-xs text-gray-500">{person.fellowship} · {person.consecutiveAbsences} services missed</p>
                      </div>
                      {person.phone ? <a href={phoneHref(person.phone)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm">Call</a> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Recent first timers</h4>
                <button onClick={() => onNavigate('first-timers')} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Open pipeline</button>
              </div>
              {care.recentFirstTimers.length === 0 ? <EmptyState>No first timers recorded in the past 28 days.</EmptyState> : (
                <div className="space-y-2">
                  {care.recentFirstTimers.slice(0, 5).map(person => (
                    <div key={`${person.name}-${person.visitDate}`} className="flex items-center justify-between gap-3 rounded-xl bg-violet-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{person.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {person.fellowship} · {person.hasReturned ? 'Returned' : `${person.daysSinceVisit} days since visit`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${person.hasReturned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {person.hasReturned ? 'Connected' : 'Follow up'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="font-bold text-gray-900">Upcoming birthdays</h3>
              <p className="mt-0.5 text-xs text-gray-500">Next 14 days</p>
            </div>
            <button onClick={() => onNavigate('demographics')} className="text-sm font-semibold text-pink-700 hover:text-pink-900">View all</button>
          </div>
          <div className="p-5">
            {care.upcomingBirthdays.length === 0 ? <EmptyState>No birthdays in the next 14 days.</EmptyState> : (
              <div className="space-y-3">
                {care.upcomingBirthdays.slice(0, 6).map(person => (
                  <div key={`${person.id || person.name}-${person.birthday}`} className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-pink-50 text-pink-700">
                      <span className="text-[10px] font-semibold uppercase">{person.daysUntil === 0 ? 'Today' : 'In'}</span>
                      <span className="text-sm font-bold">{person.daysUntil === 0 ? '🎉' : `${person.daysUntil}d`}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{person.name}</p>
                      <p className="truncate text-xs text-gray-500">{person.birthday} · {person.fellowship}</p>
                    </div>
                    {person.phone ? <a href={phoneHref(person.phone)} className="text-xs font-semibold text-pink-700">Call</a> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Attendance pulse</h3>
              <p className="mt-0.5 text-xs text-gray-500">Last {data.trend.length} recorded services · four-service average {latestService.fourWeekAverage}</p>
            </div>
          </div>
          {data.trend.length === 0 ? <EmptyState>Attendance will appear after the first service is recorded.</EmptyState> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trend} margin={{ top: 5, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip labelFormatter={label => formatServiceDate(String(label))} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="attendance" name="Attendance" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="firstTimers" name="First timers" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: '#7c3aed' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="font-bold text-gray-900">Fellowship health</h3>
            <p className="mt-0.5 text-xs text-gray-500">Member participation at the latest service</p>
          </div>
          <div className="max-h-[310px] overflow-y-auto p-5 space-y-4">
            {fellowships.length === 0 ? <EmptyState>Add members to see fellowship health.</EmptyState> : fellowships.map(fellowship => (
              <div key={fellowship.name}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-semibold text-gray-800">{fellowship.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">{fellowship.present}/{fellowship.activeMembers} · {fellowship.rate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${fellowship.rate >= 70 ? 'bg-emerald-500' : fellowship.rate >= 45 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(fellowship.rate, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {qualityIssues > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-amber-950">Member information needs attention</h3>
              <p className="mt-1 text-sm text-amber-800">
                {dataQuality.missingPhone} missing phone · {dataQuality.missingBirthday} missing birthday · {dataQuality.unassignedFellowship} unassigned fellowship
              </p>
            </div>
            <button onClick={() => onNavigate('members')} className="self-start rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">Review roster</button>
          </div>
        </section>
      )}
    </div>
  );
}
