'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import PastorDashboard from '@/components/PastorDashboard';
import FellowshipServiceBreakdown from '@/components/FellowshipServiceBreakdown';
import MemberRoster from '@/components/MemberRoster';
import RawDataTable from '@/components/RawDataTable';
import DemographicsCharts from '@/components/DemographicsCharts';
import FirstTimerWorkspace from '@/components/FirstTimerWorkspace';
import PastAttendanceEntry from '@/components/PastAttendanceEntry';
import AbsenteeismTracker from '@/components/AbsenteeismTracker';
import PastSundaysList from '@/components/PastSundaysList';
import AccessManagement from '@/components/AccessManagement';
import WelfareBirthdayCenter from '@/components/WelfareBirthdayCenter';
import PastoralWeekly from '@/components/PastoralWeekly';
import type { Permission } from '@/lib/permissions';

type AdminTab = Exclude<Permission, 'entry'>;

const tabs: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview',             label: 'Overview',          icon: '📊' },
  { id: 'care',                 label: 'My Follow-ups',     icon: '✅' },
  { id: 'past-entry',           label: 'Past Entry',        icon: '📅' },
  { id: 'past-sundays',         label: 'Past Sundays',      icon: '🗓️' },
  { id: 'absenteeism',          label: 'Absenteeism',       icon: '🚨' },
  { id: 'demographics',         label: 'Birthdays',         icon: '🎂' },
  { id: 'first-timers',         label: 'First Timers',      icon: '🆕' },
  { id: 'fellowship-services',  label: 'By Fellowship',     icon: '🏛️' },
  { id: 'members',              label: 'Member Roster',     icon: '📋' },
  { id: 'raw-data',             label: 'Raw Data',          icon: '🗃️' },
  { id: 'welfare',              label: 'Welfare / Birthdays', icon: '🎂' },
  { id: 'users',                label: 'Users & Roles',     icon: '🔐' },
];

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sessionRole, setSessionRole] = useState('');
  const [sessionUsername, setSessionUsername] = useState('');
  const [fellowshipScope, setFellowshipScope] = useState<string | undefined>();
  const [permissions, setPermissions] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const refreshSession = () => { fetch('/api/auth/check', { cache: 'no-store', credentials: 'same-origin' })
      .then(async res => {
        if (!res.ok) {
          router.push('/admin/login');
          return;
        }
        const session = await res.json();
        const visible = tabs.filter(tab => session.permissions?.includes(tab.id));
        if (!visible.length) {
          router.push('/entry');
          return;
        }
        setPermissions(session.permissions);
        setActiveTab(previous => visible.some(tab => tab.id === previous) ? previous : visible[0].id);
        setSessionRole(session.role);
        setSessionUsername(session.username || '');
        setFellowshipScope(session.role === 'fellowship_leader' ? session.fellowship : undefined);
        setIsLoading(false);
      })
      .catch(() => router.push('/admin/login')); };
    refreshSession();
    window.addEventListener('focus', refreshSession);
    return () => window.removeEventListener('focus', refreshSession);
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {}
  };

  return (
    <DashboardShell
      navigation={tabs.filter(tab => permissions.includes(tab.id))}
      activeTab={activeTab}
      onNavigate={setActiveTab}
      onLogout={handleLogout}
      username={sessionUsername}
      roleLabel={sessionRole === 'admin' ? 'Administrator' : sessionRole === 'fellowship_leader' ? 'Fellowship Leader' : 'Staff'}
      fellowship={fellowshipScope}
      loading={isLoading}
    >
      {isLoading ? <div role="status" className="flex min-h-[70dvh] flex-col items-center justify-center gap-3">
        <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-600">Loading dashboard…</p>
      </div> : <>
        {activeTab === 'overview' && (
          <PastorDashboard onNavigate={destination => { if (permissions.includes(destination)) setActiveTab(destination); }} allowedDestinations={permissions} />
        )}
        {activeTab === 'care' && <PastoralWeekly assignedOnly />}

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
              <h2 className="text-2xl font-bold text-gray-900">Birthdays</h2>
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
            <FirstTimerWorkspace />
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
              <p className="text-gray-500 text-sm mt-1">Manage brethren and organize fellowships into cells and BSCT groups</p>
            </div>
            <MemberRoster key={`${sessionRole}-${fellowshipScope || 'all'}`} fellowshipScope={fellowshipScope} canReviewDuplicates={sessionRole === 'admin'} />
          </div>
        )}

        {activeTab === 'raw-data' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Raw Attendance Data</h2>
              <p className="text-gray-500 text-sm mt-1">Filter, search, and export all attendance records</p>
            </div>
            <RawDataTable canAdminister={sessionRole === 'admin'} />
          </div>
        )}

        {activeTab === 'welfare' && permissions.includes('welfare') && <WelfareBirthdayCenter />}
        {activeTab === 'users' && permissions.includes('users') && <AccessManagement />}

      </>}
    </DashboardShell>
  );
}
