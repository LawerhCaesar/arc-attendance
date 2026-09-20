import DepartmentHeader from '@/components/DepartmentHeader';
import WelfareBirthdayCenter from '@/components/WelfareBirthdayCenter';

export default function WelfarePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DepartmentHeader
        eyebrow="Welfare department"
        title="Birthdays and member care"
        description="Prepare timely birthday outreach while keeping access focused on the member information your department needs."
        accent="rose"
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <WelfareBirthdayCenter />
      </main>
    </div>
  );
}
