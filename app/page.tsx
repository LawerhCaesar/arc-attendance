import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div 
      className="min-h-screen bg-contain bg-center bg-no-repeat bg-fixed"
      style={{ 
        backgroundImage: 'url(/background.jpg)'
      }}
    >
      <Navbar />
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center space-y-6 bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-lg">
          <h1 className="text-4xl font-bold text-gray-800">Church Attendance System</h1>
          <p className="text-gray-600">Record and track Sunday service attendance</p>
          <div className="space-x-4">
            <Link
              href="/entry"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Mark Attendance
            </Link>
            <Link
              href="/admin/login"
              className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Access Admin Panel
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

