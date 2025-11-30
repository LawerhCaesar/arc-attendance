'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendData {
  trends: Array<{ date: string; count: number }>;
  period: string;
}

export default function AttendanceTrends() {
  const [weeklyData, setWeeklyData] = useState<TrendData | null>(null);
  const [monthlyData, setMonthlyData] = useState<TrendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics/trends?period=weekly').then(res => res.json()),
      fetch('/api/analytics/trends?period=monthly').then(res => res.json()),
    ])
      .then(([weekly, monthly]) => {
        setWeeklyData(weekly);
        setMonthlyData(monthly);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching trends:', error);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="text-gray-600">Loading trends...</div>
      </div>
    );
  }

  const currentData = activePeriod === 'weekly' ? weeklyData : monthlyData;
  const chartData = currentData?.trends.map(trend => ({
    date: activePeriod === 'weekly' 
      ? `Week of ${new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : new Date(trend.date + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    attendance: trend.count,
  })) || [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Attendance Trends</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActivePeriod('weekly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activePeriod === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setActivePeriod('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activePeriod === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="attendance" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Attendance"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-gray-500 text-center py-8">No data available</div>
      )}

      {/* Bar chart for comparison */}
      {chartData.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Attendance by {activePeriod === 'weekly' ? 'Week' : 'Month'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="attendance" fill="#3b82f6" name="Attendance" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

