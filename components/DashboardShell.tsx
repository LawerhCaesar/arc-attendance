'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Permission } from '@/lib/permissions';

export type DashboardTab = Exclude<Permission, 'entry'> | 'fellowship-birthdays' | 'fellowship-attendance' | 'sunday-projections';
interface NavigationItem { id: DashboardTab; label: string; icon: string }
interface Props {
  children: ReactNode;
  navigation: NavigationItem[];
  activeTab: DashboardTab;
  onNavigate: (tab: DashboardTab) => void;
  onLogout: () => void;
  username: string;
  roleLabel: string;
  fellowship?: string;
  loading?: boolean;
}
const sections: { label: string; ids: DashboardTab[] }[] = [
  { label: 'Workspace', ids: ['overview', 'care'] },
  { label: 'People', ids: ['members', 'fellowship-birthdays', 'first-timers', 'demographics', 'welfare'] },
  { label: 'Attendance', ids: ['sunday-projections', 'fellowship-attendance', 'past-entry', 'past-sundays', 'fellowship-services', 'absenteeism', 'raw-data'] },
  { label: 'Administration', ids: ['users'] },
];

function SidebarContent({ navigation, activeTab, onNavigate, onLogout, username, roleLabel, fellowship, loading, onClose }: Omit<Props, 'children'> & { onClose?: () => void }) {
  return <div className="flex h-full min-h-0 w-full flex-col bg-slate-950 text-slate-100">
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-6 lg:py-5">
      <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white" aria-hidden="true">A</span>
        <span><span className="block text-sm font-bold tracking-wide text-white">Church Attendance</span><span className="mt-1 block text-xs text-slate-400">Your church workspace</span></span>
      </Link>
      {onClose && <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>}
    </div>
    <nav aria-label="Dashboard sections" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 lg:space-y-2 lg:py-2">
      {loading ? <div aria-label="Loading navigation" className="space-y-3 px-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-white/10" />)}</div> : sections.map(section => {
        const items = section.ids.map(id => navigation.find(item => item.id === id)).filter((item): item is NavigationItem => Boolean(item));
        if (!items.length) return null;
        return <div key={section.label}><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 lg:mb-1 lg:text-[10px] lg:leading-4">{section.label}</p><div className="space-y-1 lg:space-y-0.5">{items.map(item => <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 lg:py-1 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
          <span aria-hidden="true" className="flex w-5 shrink-0 justify-center text-base leading-5">{item.icon}</span><span>{item.label}</span>
        </button>)}</div></div>;
      })}
    </nav>
    <div className="shrink-0 space-y-4 border-t border-white/10 p-4 lg:space-y-3 lg:p-3">
      <Link href="/entry" className="flex items-center justify-between rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400 lg:py-2">Record Attendance<span aria-hidden="true">↗</span></Link>
      {!loading && <Link href="/account" aria-label="My profile" className="flex items-start gap-3 rounded-lg px-1 focus:outline-none focus:ring-2 focus:ring-blue-400">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-blue-200">{username.slice(0, 1).toUpperCase() || 'S'}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white" title={username}>{username}</p><p className="text-xs text-blue-200">My profile</p><p className="mt-0.5 text-xs text-slate-400">{roleLabel}{fellowship ? ` · ${fellowship}` : ''}</p></div>
      </Link>}
      {!loading && <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 lg:py-1.5"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 5H5v14h4M10 12h10m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>Sign Out</button>}
    </div>
  </div>;
}

export default function DashboardShell({ children, ...props }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activeLabel = props.navigation.find(item => item.id === props.activeTab)?.label || 'Dashboard';
  const navigate = (tab: DashboardTab) => { props.onNavigate(tab); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'auto' }); };
  useEffect(() => {
    if (!mobileOpen) return;
    const element = drawer.current;
    const trigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; trigger?.focus({ preventScroll: true }); };
  }, [mobileOpen]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return <div className="min-h-dvh bg-slate-50 text-gray-900">
    <a href="#dashboard-content" className="sr-only left-4 top-4 z-[60] rounded-lg bg-white px-4 py-3 font-semibold text-blue-800 shadow focus:not-sr-only focus:fixed">Skip to content</a>
    <aside aria-label="Dashboard sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:flex"><SidebarContent {...props} onNavigate={navigate} /></aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button ref={menuButton} type="button" disabled={props.loading} onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-controls="dashboard-mobile-navigation" aria-expanded={mobileOpen} className="rounded-lg border border-gray-200 p-2.5 text-slate-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        <div><p className="text-xs text-gray-500">Church Attendance</p><p className="text-sm font-bold text-gray-950">{props.loading ? 'Loading workspace…' : activeLabel}</p></div>
      </header>
      <main id="dashboard-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 focus:outline-none sm:px-6 lg:p-8" aria-busy={props.loading}>
        <h1 className="sr-only">{props.roleLabel} dashboard</h1>
        {children}
      </main>
    </div>
    <dialog ref={drawer} id="dashboard-mobile-navigation" aria-label="Navigation menu" className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100%_-_3rem))] max-w-none overflow-hidden border-0 bg-slate-950 p-0 text-slate-100 backdrop:bg-slate-950/50 lg:hidden" onCancel={event => { event.preventDefault(); setMobileOpen(false); }} onClick={event => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
      {mobileOpen && <SidebarContent {...props} onNavigate={navigate} onClose={() => setMobileOpen(false)} />}
    </dialog>
  </div>;
}
