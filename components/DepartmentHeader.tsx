'use client';

import { useRouter } from 'next/navigation';

interface DepartmentHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  accent?: 'rose' | 'violet';
}

export default function DepartmentHeader({ eyebrow, title, description, accent = 'violet' }: DepartmentHeaderProps) {
  const router = useRouter();
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const gradient = accent === 'rose'
    ? 'from-rose-950 via-pink-900 to-fuchsia-800'
    : 'from-slate-950 via-violet-950 to-indigo-900';

  return (
    <header className={`bg-gradient-to-br ${gradient} text-white shadow-lg`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{description}</p>
        </div>
        <button onClick={signOut} className="self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
          Sign out
        </button>
      </div>
    </header>
  );
}
