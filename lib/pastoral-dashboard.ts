import type { AttendanceRecord, Member } from './database';

export interface CarePerson {
  id?: string;
  name: string;
  phone: string;
  fellowship: string;
}

export interface PastoralDashboardData {
  generatedAt: string;
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
const phoneDigits = (value?: string) => (value || '').replace(/\D/g, '');

function personKey(person: Pick<Member, 'name' | 'phone' | 'fellowship'> | AttendanceRecord): string {
  const phone = phoneDigits(person.phone);
  if (phone.length >= 7) return `phone:${phone}`;
  return `name:${normalize(person.name)}|${normalize(person.fellowship)}`;
}

function matchesMember(record: AttendanceRecord, member: Member): boolean {
  const memberPhone = phoneDigits(member.phone);
  const recordPhone = phoneDigits(record.phone);
  if (memberPhone.length >= 7 && recordPhone.length >= 7) return memberPhone === recordPhone;
  return normalize(record.name) === normalize(member.name) &&
    normalize(record.fellowship) === normalize(member.fellowship);
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function parseBirthday(value: string, today: Date): { daysUntil: number; display: string } | null {
  const clean = value.trim();
  if (!clean) return null;

  let day = 0;
  let month = 0;
  const iso = clean.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  const dayFirst = clean.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
  if (iso) {
    month = Number(iso[1]);
    day = Number(iso[2]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = Number(dayFirst[2]);
  }
  if (!day || !month || month > 12 || day > 31) return null;

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < start) next = new Date(today.getFullYear() + 1, month - 1, day);
  const daysUntil = Math.round((next.getTime() - start.getTime()) / 86_400_000);
  const display = next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { daysUntil, display };
}

export function buildPastoralDashboard(
  attendance: AttendanceRecord[],
  members: Member[],
  now = new Date()
): PastoralDashboardData {
  const dates = Array.from(new Set(attendance.map(serviceDate).filter(Boolean))).sort();
  const latestDate = dates.at(-1) || null;
  const previousDate = dates.at(-2) || null;
  const recentDates = dates.slice(-8);

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

  const latestRecords = latestDate ? recordsByDate.get(latestDate) || [] : [];
  const latestFirstTimerKeys = new Set(latestRecords.filter(isFirstTimer).map(personKey));
  const firstTimerHistory = new Map<string, string>();
  attendance
    .filter(isFirstTimer)
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
    latestRecords.some(record => isPresent(record) && matchesMember(record, member))
  ).length;

  const absentMembers = members.flatMap(member => {
    const memberRecords = attendance.filter(record => matchesMember(record, member));
    const firstKnownDate = member.created_at?.slice(0, 10) ||
      memberRecords.map(serviceDate).filter(Boolean).sort()[0];
    if (!firstKnownDate) return [];

    const eligibleDates = dates.filter(date => date >= firstKnownDate).slice(-8).reverse();
    let consecutiveAbsences = 0;
    let lastSeen: string | null = null;

    for (const date of eligibleDates) {
      const record = memberRecords.find(item => serviceDate(item) === date);
      if (record && isPresent(record)) {
        lastSeen ||= date;
        if (consecutiveAbsences === 0) continue;
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

  const todayIso = now.toISOString().slice(0, 10);
  const recentFirstTimers = Array.from(firstTimerHistory.entries()).flatMap(([key, visitDate]) => {
    const record = attendance.find(item => personKey(item) === key && serviceDate(item) === visitDate);
    if (!record) return [];
    const daysSinceVisit = daysBetween(visitDate, todayIso);
    if (daysSinceVisit > 28) return [];
    const hasReturned = attendance.some(item => personKey(item) === key && isPresent(item) && serviceDate(item) > visitDate);
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
    const birthday = parseBirthday(member.birthday || '', now);
    if (!birthday || birthday.daysUntil > 14) return [];
    return [{
      id: member.id,
      name: member.name,
      phone: member.phone || '',
      fellowship: member.fellowship || 'Unassigned',
      birthday: birthday.display,
      daysUntil: birthday.daysUntil,
    }];
  }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 12);

  const fellowshipNames = Array.from(new Set(members.map(member => member.fellowship || 'Unassigned'))).sort();
  const fellowships = fellowshipNames.map(name => {
    const fellowshipMembers = members.filter(member => (member.fellowship || 'Unassigned') === name);
    const latestCount = fellowshipMembers.filter(member =>
      latestRecords.some(record => isPresent(record) && matchesMember(record, member))
    ).length;
    const previousRecords = previousDate ? recordsByDate.get(previousDate) || [] : [];
    const previousCount = fellowshipMembers.filter(member =>
      previousRecords.some(record => isPresent(record) && matchesMember(record, member))
    ).length;
    return {
      name,
      present: latestCount,
      activeMembers: fellowshipMembers.length,
      rate: fellowshipMembers.length ? Math.round((latestCount / fellowshipMembers.length) * 100) : 0,
      change: latestCount - previousCount,
    };
  }).sort((a, b) => b.rate - a.rate);

  return {
    generatedAt: now.toISOString(),
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
      firstTimers: latestFirstTimerKeys.size,
      returningVisitors,
    },
    trend: recentDates.map(date => ({
      date,
      attendance: uniquePresent(date).size,
      firstTimers: new Set((recordsByDate.get(date) || []).filter(isFirstTimer).map(personKey)).size,
    })),
    care: { absentMembers, recentFirstTimers, upcomingBirthdays },
    fellowships,
    dataQuality: {
      missingPhone: members.filter(member => !member.phone?.trim()).length,
      missingBirthday: members.filter(member => !member.birthday?.trim()).length,
      unassignedFellowship: members.filter(member => !member.fellowship?.trim() || member.fellowship === 'Unassigned').length,
    },
  };
}
