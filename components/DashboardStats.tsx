'use client';

import { useState, useEffect } from 'react';

interface SummaryData {
  totalAttendance: number;
  uniqueVisitors: number;
  repeatVisitors: number;
  totalServices: number;
  latestDate: string;
  latestAttendance: number;
  averageAttendance: number;
}

export default function DashboardStats() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/summary')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching summary:', error);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className="text-gray-600 mb-6">Loading statistics...</div>;
  }

  if (!data) {
    return <div className="text-red-600 mb-6">Failed to load statistics</div>;
  }

  const stats = [
    {
      label: 'Total Attendance',
      value: data.totalAttendance,
      color: 'bg-blue-500',
    },
    {
      label: 'Unique Visitors',
      value: data.uniqueVisitors,
      color: 'bg-green-500',
    },
    {
      label: 'Repeat Visitors',
      value: data.repeatVisitors,
      color: 'bg-purple-500',
    },
    {
      label: 'Total Services',
      value: data.totalServices,
      color: 'bg-orange-500',
    },
    {
      label: 'Latest Attendance',
      value: data.latestAttendance,
      color: 'bg-indigo-500',
      subtitle: data.latestDate ? `on ${new Date(data.latestDate).toLocaleDateString()}` : '',
    },
    {
      label: 'Average per Service',
      value: data.averageAttendance,
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-md p-6 border-l-4"
          style={{ borderLeftColor: stat.color.replace('bg-', '').split('-')[1] }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
              {stat.subtitle && (
                <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
              )}
            </div>
            <div className={`${stat.color} w-12 h-12 rounded-full flex items-center justify-center opacity-20`}>
              <div className={`${stat.color} w-8 h-8 rounded-full`}></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

