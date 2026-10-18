import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-xl font-bold hover:text-gray-300">
              Church Attendance
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/account" className="rounded-md px-3 py-2 text-sm font-medium transition hover:bg-gray-700">My profile</Link>
            <Link
              href="/entry"
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
            >
              Record Attendance
            </Link>
            <Link
              href="/admin/login"
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

