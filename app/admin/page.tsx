'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell, { type DashboardTab } from '@/components/DashboardShell';
import PastorDashboard from '@/components/PastorDashboard';
import FellowshipServiceBreakdown from '@/components/FellowshipServiceBreakdown';
import MemberRoster from '@/components/MemberRoster';
import UpcomingFellowshipBirthdays from '@/components/UpcomingFellowshipBirthdays';
import FellowshipBirthdays from '@/components/FellowshipBirthdays';
import FellowshipAttendanceHistory from '@/components/FellowshipAttendanceHistory';
import SundayAttendanceProjections from '@/components/SundayAttendanceProjections';
import RawDataTable from '@/components/RawDataTable';
import DemographicsCharts from '@/components/DemographicsCharts';
import FirstTimerWorkspace from '@/components/FirstTimerWorkspace';
import PastAttendanceEntry from '@/components/PastAttendanceEntry';
import AbsenteeismTracker from '@/components/AbsenteeismTracker';
import PastSundaysList from '@/components/PastSundaysList';
import AccessManagement from '@/components/AccessManagement';
import WelfareBirthdayCenter from '@/components/WelfareBirthdayCenter';
import PastoralWeekly from '@/components/PastoralWeekly';
import BulkSms from '@/components/BulkSms';
import FellowshipStructureWorkspace from '@/components/FellowshipStructureWorkspace';
type AdminTab = DashboardTab;

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
  { id: 'fellowship-structure',  label: 'Cells & BSCTs',     icon: '🏘️' },
  { id: 'raw-data',             label: 'Raw Data',          icon: '🗃️' },
  { id: 'welfare',              label: 'Welfare / Birthdays', icon: '🎂' },
  { id: 'users',                label: 'Users & Roles',     icon: '🔐' },
  { id: 'bulk-sms',             label: 'Bulk SMS',          icon: '✉️' },
  { id: 'fellowship-birthdays',  label: 'Birthdays',         icon: '🎂' },
  { id: 'fellowship-attendance', label: 'Fellowship Attendance History', icon: '📈' },
  { id: 'sunday-projections', label: 'Sunday Projections', icon: '☑️' },
];

// These scoped views belong to the fellowship roster permission. They do not
// grant access to church-wide birthday or raw attendance endpoints.
function visibleTabs(role: string, permissions: string[]) {
  return tabs.filter(tab => {
    if (tab.id === 'bulk-sms') return role === 'admin';
    if (tab.id === 'fellowship-structure') return role === 'fellowship_leader' && permissions.includes('members');
    if (tab.id === 'care' && role === 'fellowship_leader') return permissions.includes('members');
    if (tab.id === 'fellowship-birthdays') return role === 'fellowship_leader' && permissions.includes('members');
    if (tab.id === 'fellowship-attendance') return role === 'fellowship_leader' ? permissions.includes('members') : permissions.includes('fellowship-services');
    if (tab.id === 'sunday-projections') return role === 'fellowship_leader' ? permissions.includes('members') : permissions.includes('overview') || permissions.includes('fellowship-services');
    return permissions.includes(tab.id);
  }).map(tab => tab.id === 'care' && role === 'fellowship_leader' ? { ...tab, label: 'Care Centre' } : tab);
}

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sessionRole, setSessionRole] = useState('');
  const [sessionUsername, setSessionUsername] = useState('');
  const [fellowshipScope, setFellowshipScope] = useState<string | undefined>();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [rosterVersion, setRosterVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const refreshSession = () => { fetch('/api/auth/check', { cache: 'no-store', credentials: 'same-origin' })
      .then(async res => {
        if (!res.ok) {
          router.push('/admin/login');
          return;
        }
        const session = await res.json();
        const visible = visibleTabs(session.role, session.permissions || []);
        if (!visible.length) {
          router.push('/entry');
          return;
        }
        setPermissions(session.permissions);
        setActiveTab(previous => visible.some(tab => tab.id === previous) ? previous : session.role === 'fellowship_leader' && visible.some(tab => tab.id === 'members') ? 'members' : visible[0].id);
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
      navigation={visibleTabs(sessionRole, permissions)}
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
        {activeTab === 'care' && <PastoralWeekly assignedOnly={sessionRole !== 'fellowship_leader'} fellowshipCare={sessionRole === 'fellowship_leader'} canEditMembers={permissions.includes('members')} onMemberSaved={() => setRosterVersion(value => value + 1)} />}
        {sessionRole === 'fellowship_leader' && activeTab === 'fellowship-birthdays' && <FellowshipBirthdays key={fellowshipScope} />}
        {activeTab === 'fellowship-attendance' && <FellowshipAttendanceHistory key={fellowshipScope} canChooseFellowship={sessionRole !== 'fellowship_leader'} />}
        {activeTab === 'sunday-projections' && <SundayAttendanceProjections key={`${sessionRole}-${fellowshipScope || 'all'}`} />}
        {activeTab === 'fellowship-structure' && fellowshipScope && <FellowshipStructureWorkspace key={fellowshipScope} fellowship={fellowshipScope} onRosterChanged={() => setRosterVersion(value => value + 1)} />}

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
            {sessionRole === 'fellowship_leader' && (
              <div className="mb-6">
                <UpcomingFellowshipBirthdays key={`${fellowshipScope}-${rosterVersion}`} />
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Member Roster</h2>
              <p className="text-gray-500 text-sm mt-1">Manage brethren and keep fellowship details up to date</p>
            </div>
            <MemberRoster key={`${sessionRole}-${fellowshipScope || 'all'}`} fellowshipScope={fellowshipScope} canReviewDuplicates={sessionRole === 'admin'} onRosterChanged={() => setRosterVersion(value => value + 1)} />
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
        {activeTab === 'bulk-sms' && sessionRole === 'admin' && <BulkSms />}

      </>}
    </DashboardShell>
  );
}
