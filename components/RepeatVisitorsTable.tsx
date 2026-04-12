'use client';

import { useState, useEffect } from 'react';

interface RepeatVisitor {
  name: string;
  phone: string;
  count: number;
  lastVisit: string;
}

interface RepeatVisitorsData {
  repeatVisitors: RepeatVisitor[];
  statistics: {
    totalUniqueVisitors: number;
    totalRepeatVisitors: number;
    averageVisits: number;
  };
}

export default function RepeatVisitorsTable() {
  const [data, setData] = useState<RepeatVisitorsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/repeat-visitors')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching repeat visitors:', error);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-64 bg-gray-50 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="text-red-500">Failed to load repeat visitors</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Repeat Visitors Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Unique Visitors</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{data.statistics.totalUniqueVisitors}</p>
          </div>
          <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Repeat Visitors</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{data.statistics.totalRepeatVisitors}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Average Visits</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{data.statistics.averageVisits.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {data.repeatVisitors.length > 0 ? (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Phone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Visit Count
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Last Visit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {data.repeatVisitors.map((visitor, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{visitor.name.charAt(0)}</div>
                      {visitor.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {visitor.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                      {visitor.count} visits
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(visitor.lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-400 text-center py-12 border border-gray-100 rounded-lg bg-gray-50/50">No repeat visitors data available</div>
      )}
    </div>
  );
}

