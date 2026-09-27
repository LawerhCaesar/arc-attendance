'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DemographicsData {
  locations: Array<{ location: string; count: number }>;
  birthdays: Array<{ month: string; count: number }>;
  totalMembers: number;
  validBirthdays: number;
  missingBirthdays: number;
  invalidBirthdays: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DemographicsCharts() {
  const [data, setData] = useState<DemographicsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/demographics', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Unable to load demographics');
        return res.json();
      })
      .then(data => {
        setData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching demographics:', error);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse h-[300px]" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse h-[300px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
        <div className="text-red-500">Failed to load demographics</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Location Pie Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Members by Location</h2>
        <p className="mb-4 text-sm text-gray-500">Current active roster · {data.totalMembers} members, each counted once</p>
        {data.locations && data.locations.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.locations}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ location, percent }) => `${location}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.locations.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-400 text-center flex items-center justify-center h-[300px]">No location data available</div>
        )}
      </div>

      {/* Birthdays Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Member Birthdays by Month</h2>
        <p className="mb-4 text-sm text-gray-600">{data.validBirthdays} valid birthdays out of {data.totalMembers} active members · {data.missingBirthdays} missing · {data.invalidBirthdays} invalid. Each member is counted once, not once per attendance.</p>
        {data.validBirthdays > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.birthdays}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="month" tickFormatter={month => String(month).slice(0, 3)} interval={0} axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
              <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
              <Bar dataKey="count" fill="#ec4899" name="Members" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-400 text-center flex items-center justify-center h-[300px]">No birthday data available</div>
        )}
      </div>
    </div>
  );
}
