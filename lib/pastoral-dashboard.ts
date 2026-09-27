import type { AttendanceRecord, Member } from './database';
import { indexAttendanceByMember, normalizePhone } from './attendance-identity';
import { dateInAccra, nextBirthday } from './birthdays';
import type { DashboardRange } from './dashboard-period';

export interface CarePerson {
  id?: string;
  name: string;
  phone: string;
  fellowship: string;
}

export interface PastoralDashboardData {
  generatedAt: string;
  period?: DashboardRange & {
    attendance: number;
    uniquePeople: number;
    services: number;
    averageAttendance: number;
    memberAttendanceRate: number;
    firstTimers: number;
  };
  latestService: {
    date: string | null;
    attendance: number;
    previousAttendance: number;
    changePercent: number | null;
    fourWeekAverage: number;
    activeMembers: number;
    memberAttendanceRate: number;
    firstTimers: number;
    returningVisitors: number;
  };
  trend: Array<{ date: string; attendance: number; firstTimers: number }>;
  care: {
    absentMembers: Array<CarePerson & {
      consecutiveAbsences: number;
      lastSeen: string | null;
    }>;
    recentFirstTimers: Array<CarePerson & {
      visitDate: string;
      daysSinceVisit: number;
      hasReturned: boolean;
    }>;
    upcomingBirthdays: Array<CarePerson & {
      birthday: string;
      daysUntil: number;
    }>;
  };
  fellowships: Array<{
    name: string;
    present: number;
    activeMembers: number;
    rate: number;
    change: number;
  }>;
  dataQuality: {
    missingPhone: number;
    missingBirthday: number;
    unassignedFellowship: number;
  };
}

const serviceDate = (record: AttendanceRecord) => record.attendanceDate || record.date || '';
const isPresent = (record: AttendanceRecord) => record.attendanceStatus === 'present' || !record.attendanceStatus;
const isFirstTimer = (record: AttendanceRecord) =>
  ['yes', 'true', '1'].includes(String(record.firstTimer || '').trim().toLowerCase());

const normalize = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const phoneDigits = normalizePhone;

function personKey(person: Pick<Member, 'name' | 'phone' | 'fellowship'> | AttendanceRecord): string {
  if ('member_id' in person && person.member_id) return `member:${person.member_id}`;
  const phone = phoneDigits(person.phone);
  if (phone.length >= 7) return `phone:${phone}`;
  return `name:${normalize(person.name)}|${normalize(person.fellowship)}`;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function buildPastoralDashboard(
  attendance: AttendanceRecord[],
  members: Member[],
  now = new Date(),
  range?: DashboardRange
): PastoralDashboardData {
  members = members.filter(member => member.is_active !== false);
  const inRange = (date: string) => !range || (date >= range.start && date <= range.end);
  const attendanceForMember = indexAttendanceByMember(attendance);
  const dates = Array.from(new Set(attendance.map(serviceDate).filter(Boolean))).sort();
  const latestDate = dates.at(-1) || null;
  const previousDate = dates.at(-2) || null;
  const recentDates = range ? dates.filter(inRange) : dates.slice(-8);

  const recordsByDate = new Map<string, AttendanceRecord[]>();
  dates.forEach(date => recordsByDate.set(date, attendance.filter(record => serviceDate(record) === date)));

  const uniquePresent = (date: string | null) => {
    if (!date) return new Set<string>();
    return new Set((recordsByDate.get(date) || []).filter(isPresent).map(personKey));
  };

  const latestPresent = uniquePresent(latestDate);
  const previousPresent = uniquePresent(previousDate);
  const latestAttendance = latestPresent.size;
  const previousAttendance = previousPresent.size;
  const fourWeekCounts = dates.slice(-4).map(date => uniquePresent(date).size);
  const fourWeekAverage = fourWeekCounts.length
    ? Math.round(fourWeekCounts.reduce((sum, count) => sum + count, 0) / fourWeekCounts.length)
    : 0;

  const firstTimerHistory = new Map<string, string>();
  attendance
    .filter(record => isFirstTimer(record) && isPresent(record))
    .sort((a, b) => serviceDate(a).localeCompare(serviceDate(b)))
    .forEach(record => {
      const key = personKey(record);
      if (!firstTimerHistory.has(key)) firstTimerHistory.set(key, serviceDate(record));
    });
  const returningVisitors = Array.from(latestPresent).filter(key => {
    const firstVisit = firstTimerHistory.get(key);
    return Boolean(firstVisit && latestDate && firstVisit < latestDate);
  }).length;

  const presentMemberCount = members.filter(member =>
    attendanceForMember(member).some(record => serviceDate(record) === latestDate && isPresent(record))
  ).length;

  const absentMembers = members.flatMap(member => {
    const memberRecords = attendanceForMember(member);
    const firstKnownDate = member.created_at?.slice(0, 10) ||
      memberRecords.map(serviceDate).filter(Boolean).sort()[0];
    if (!firstKnownDate) return [];

    const eligibleDates = dates.filter(date => date >= firstKnownDate).slice(-8).reverse();
    let consecutiveAbsences = 0;
    let lastSeen: string | null = null;

    for (const date of eligibleDates) {
      const present = memberRecords.some(item => serviceDate(item) === date && isPresent(item));
      if (present) {
        lastSeen ||= date;
        break;
      }
      consecutiveAbsences += 1;
    }

    if (!lastSeen) {
      lastSeen = memberRecords.filter(isPresent).map(serviceDate).filter(Boolean).sort().at(-1) || null;
    }
    if (consecutiveAbsences < 2) return [];

    return [{
      id: member.id,
      name: member.name,
      phone: member.phone || '',
      fellowship: member.fellowship || 'Unassigned',
      consecutiveAbsences,
      lastSeen,
    }];
  }).sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences).slice(0, 12);

  const todayIso = dateInAccra(now);
  const recentFirstTimers = Array.from(firstTimerHistory.entries()).flatMap(([key, visitDate]) => {
    const record = attendance.find(item => personKey(item) === key && serviceDate(item) === visitDate);
    if (!record) return [];
    const daysSinceVisit = daysBetween(visitDate, todayIso);
    if (range ? !inRange(visitDate) : daysSinceVisit > 28) return [];
    const hasReturned = attendance.some(item => personKey(item) === key && isPresent(item) && serviceDate(item) > visitDate && (!range || serviceDate(item) <= range.end));
    return [{
      name: record.name,
      phone: record.phone || '',
      fellowship: record.fellowship || 'Unassigned',
      visitDate,
      daysSinceVisit,
      hasReturned,
    }];
  }).sort((a, b) => b.visitDate.localeCompare(a.visitDate)).slice(0, 12);

  const upcomingBirthdays = members.flatMap(member => {
    const birthday = nextBirthday(member.birthday || '', todayIso);
    if (!birthday || birthday.daysUntil > 14) return [];
    return [{
      id: member.id,
      name: member.name,
      phone: member.phone || '',
      fellowship: member.fellowship || 'Unassigned',
      birthday: birthday.display,
      daysUntil: birthday.daysUntil,
    }];
  }).sort((a, b) => a.daysUntil - b.daysUntil);

  const fellowshipNames = Array.from(new Set(members.map(member => member.fellowship || 'Unassigned'))).sort();
  const fellowships = fellowshipNames.map(name => {
    const fellowshipMembers = members.filter(member => (member.fellowship || 'Unassigned') === name);
    const latestCount = fellowshipMembers.filter(member =>
      attendanceForMember(member).some(record => (range ? inRange(serviceDate(record)) : serviceDate(record) === latestDate) && isPresent(record))
    ).length;
    const previousCount = fellowshipMembers.filter(member =>
      attendanceForMember(member).some(record => serviceDate(record) === previousDate && isPresent(record))
    ).length;
    return {
      name,
      present: latestCount,
      activeMembers: fellowshipMembers.length,
      rate: fellowshipMembers.length ? Math.round((latestCount / fellowshipMembers.length) * 100) : 0,
      change: latestCount - previousCount,
    };
  }).sort((a, b) => b.rate - a.rate);

  const selectedPresent = attendance.filter(record => inRange(serviceDate(record)) && isPresent(record));
  const periodAttendance = recentDates.reduce((sum, date) => sum + uniquePresent(date).size, 0);
  const periodMembers = members.filter(member => attendanceForMember(member).some(record => inRange(serviceDate(record)) && isPresent(record))).length;

  return {
    generatedAt: now.toISOString(),
    ...(range ? { period: {
      ...range,
      attendance: periodAttendance,
      uniquePeople: new Set(selectedPresent.map(personKey)).size,
      services: recentDates.length,
      averageAttendance: recentDates.length ? Math.round(periodAttendance / recentDates.length) : 0,
      memberAttendanceRate: members.length ? Math.round(periodMembers / members.length * 100) : 0,
      firstTimers: Array.from(firstTimerHistory.values()).filter(inRange).length,
    } } : {}),
    latestService: {
      date: latestDate,
      attendance: latestAttendance,
      previousAttendance,
      changePercent: previousAttendance > 0
        ? Math.round(((latestAttendance - previousAttendance) / previousAttendance) * 100)
        : null,
      fourWeekAverage,
      activeMembers: members.length,
      memberAttendanceRate: members.length ? Math.round((presentMemberCount / members.length) * 100) : 0,
      firstTimers: Array.from(firstTimerHistory.values()).filter(date => date === latestDate).length,
      returningVisitors,
    },
    trend: recentDates.map(date => ({
      date,
      attendance: uniquePresent(date).size,
      firstTimers: Array.from(firstTimerHistory.values()).filter(firstVisit => firstVisit === date).length,
    })),
    care: { absentMembers, recentFirstTimers, upcomingBirthdays },
    fellowships,
    dataQuality: {
      missingPhone: members.filter(member => !member.phone?.trim()).length,
      missingBirthday: members.filter(member => !nextBirthday(member.birthday || '', todayIso)).length,
      unassignedFellowship: members.filter(member => !member.fellowship?.trim() || member.fellowship === 'Unassigned').length,
    },
  };
}
