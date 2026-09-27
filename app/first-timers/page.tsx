import DepartmentHeader from '@/components/DepartmentHeader';
import FirstTimerWorkspace from '@/components/FirstTimerWorkspace';
import { hasPermission } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function FirstTimersDepartmentPage() {
  if (!(await hasPermission('first-timers'))) redirect('/admin');
  return (
    <div className="min-h-screen bg-gray-50">
      <DepartmentHeader
        eyebrow="First timers department"
        title="Visitor progression"
        description="Follow every new visitor from their first service through contact, return, fellowship connection, and membership."
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <FirstTimerWorkspace />
      </main>
    </div>
  );
}
