'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import DashboardStats from '@/components/DashboardStats';
import AttendanceTrends from '@/components/AttendanceTrends';
import FellowshipServiceBreakdown from '@/components/FellowshipServiceBreakdown';
import MemberRoster from '@/components/MemberRoster';
import RawDataTable from '@/components/RawDataTable';
import DemographicsCharts from '@/components/DemographicsCharts';
import FirstTimersAnalysis from '@/components/FirstTimersAnalysis';
import PastAttendanceEntry from '@/components/PastAttendanceEntry';
import AbsenteeismTracker from '@/components/AbsenteeismTracker';
import PastSundaysList from '@/components/PastSundaysList';

type AdminTab = 'overview' | 'past-entry' | 'past-sundays' | 'absenteeism' | 'demographics' | 'first-timers' | 'fellowship-services' | 'members' | 'raw-data';

const tabs: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview',             label: 'Overview',          icon: '📊' },
  { id: 'past-entry',           label: 'Past Entry',        icon: '📅' },
  { id: 'past-sundays',         label: 'Past Sundays',      icon: '🗓️' },
  { id: 'absenteeism',          label: 'Absenteeism',       icon: '🚨' },
  { id: 'demographics',         label: 'Demographics',      icon: '🎂' },
  { id: 'first-timers',         label: 'First Timers',      icon: '🆕' },
  { id: 'fellowship-services',  label: 'By Fellowship',     icon: '🏛️' },
  { id: 'members',              label: 'Member Roster',     icon: '📋' },
  { id: 'raw-data',             label: 'Raw Data',          icon: '🗃️' },
];

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/check')
      .then(res => {
        if (!res.ok) router.push('/admin/login');
        else setIsLoading(false);
      })
      .catch(() => router.push('/admin/login'));
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-500 text-sm">Loading dashboard…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {activeTab === 'overview' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Attendance Overview</h2>
              <p className="text-gray-500 text-sm mt-1">All-time summary across all fellowships</p>
            </div>
            <DashboardStats />
            <AttendanceTrends />
          </div>
        )}

        { activeTab === 'past-entry' && (
          <div>
            <PastAttendanceEntry />
          </div>
        )}

        { activeTab === 'past-sundays' && (
          <div>
            <PastSundaysList />
          </div>
        )}

        {activeTab === 'absenteeism' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Absenteeism Tracker</h2>
              <p className="text-gray-500 text-sm mt-1">Track attendance consistency and flag inactive members</p>
            </div>
            <AbsenteeismTracker />
          </div>
        )}

        {activeTab === 'demographics' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Demographics & Birthdays</h2>
              <p className="text-gray-500 text-sm mt-1">Insights on attendance locations and upcoming birthdays</p>
            </div>
            <DemographicsCharts />
          </div>
        )}

        {activeTab === 'first-timers' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">First Timer Analysis</h2>
              <p className="text-gray-500 text-sm mt-1">Track first-time visitors and their attendance history</p>
            </div>
            <FirstTimersAnalysis />
          </div>
        )}

        {activeTab === 'fellowship-services' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Fellowship Breakdown by Service</h2>
              <p className="text-gray-500 text-sm mt-1">Attendance per fellowship for each recorded service</p>
            </div>
            <FellowshipServiceBreakdown />
          </div>
        )}

        {activeTab === 'members' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Member Roster</h2>
              <p className="text-gray-500 text-sm mt-1">Manage the pre-loaded member roster used for Cell Leader Check-In</p>
            </div>
            <MemberRoster />
          </div>
        )}

        {activeTab === 'raw-data' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Raw Attendance Data</h2>
              <p className="text-gray-500 text-sm mt-1">Filter, search, and export all attendance records</p>
            </div>
            <RawDataTable />
          </div>
        )}

      </div>
    </div>
  );
}
