'use client';

import { useState, useEffect } from 'react';

interface FirstTimer {
  name: string;
  phone: string;
  fellowship: string;
  visitDate: string;
}

interface FirstTimersData {
  firstTimers: FirstTimer[];
  totalCount: number;
}

export default function FirstTimersAnalysis() {
  const [data, setData] = useState<FirstTimersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/first-timers')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching first timers:', error);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-64 bg-gray-50 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="text-red-500">Failed to load first timers data</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900">First Timer Analysis</h2>
        <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
           <span className="text-blue-800 font-semibold text-sm">Total First Timers: {data.totalCount}</span>
        </div>
      </div>

      {data.firstTimers.length > 0 ? (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fellowship</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {data.firstTimers.map((visitor, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{visitor.name.charAt(0)}</div>
                      {visitor.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.fellowship}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(visitor.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-400 text-center py-12 border border-gray-100 rounded-lg bg-gray-50/50">No first timers data available</div>
      )}
    </div>
  );
}
