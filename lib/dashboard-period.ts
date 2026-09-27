import { dateInAccra } from './birthdays';

export type DashboardPeriod = 'today' | 'month' | 'ytd' | 'custom';
export interface DashboardRange { start: string; end: string }

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dashboardRange(period: string, start?: string | null, end?: string | null, now = new Date()): DashboardRange {
  const today = dateInAccra(now);
  if (period === 'today') return { start: today, end: today };
  if (period === 'month') {
    const [year, month] = today.split('-').map(Number);
    return { start: `${today.slice(0, 7)}-01`, end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
  }
  if (period === 'ytd') return { start: `${today.slice(0, 4)}-01-01`, end: today };
  if (period !== 'custom' || !start || !end || !validCalendarDate(start) || !validCalendarDate(end) || start > end) {
    throw new Error('Choose valid start and end dates, with the end on or after the start.');
  }
  return { start, end };
}
