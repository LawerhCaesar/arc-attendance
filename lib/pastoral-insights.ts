import type { AttendanceRecord, Member } from './database';
import { reconcileFellowshipAttendance } from './fellowship-attendance';
import { dateInAccra, nextBirthday } from './birthdays';

export interface CareSuggestion {
  personRef: string; name: string; phone: string; fellowship: string;
  category: 'absence' | 'visitor' | 'birthday'; reason: string;
}
export function buildPastoralInsights(attendance: AttendanceRecord[], members: Member[], now = new Date()) {
  const today = dateInAccra(now);
  const shift = (day: string, count: number) => {
    const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
  };
  const active = members.filter(member => member.is_active !== false);
  const rows = reconcileFellowshipAttendance(attendance.filter(row => (row.attendanceDate || row.date) <= today), active);
  const dates = [...new Set(rows.map(row => row.attendanceDate!))].sort();
  const latestDate = dates.at(-1) || null;
  const previousDate = dates.at(-2) || null;
  const presentRows = rows.filter(row => row.attendanceStatus === 'present');
  const visits = new Map<string, typeof rows>();
  const firstVisits = new Map<string, typeof rows[number]>();
  for (const row of presentRows) {
    const list = visits.get(row.personId) || []; list.push(row); visits.set(row.personId, list);
    if (['yes', 'true', '1'].includes(String(row.firstTimer).toLowerCase())) {
      const prior = firstVisits.get(row.personId);
      if (!prior || row.attendanceDate! < prior.attendanceDate!) firstVisits.set(row.personId, row);
    }
  }
  const latest = presentRows.filter(row => row.attendanceDate === latestDate);
  const previous = presentRows.filter(row => row.attendanceDate === previousDate);
  const suggestions: CareSuggestion[] = [];
  const returnedMembers: Array<{ name: string; fellowship: string }> = [];
  let consistentMembers = 0;
  let eligibleMembers = 0;
  const recentFour = dates.slice(-4);
  for (const member of active) {
    if (!member.id) continue;
    const id = `member:${member.id}`;
    const history = visits.get(id) || [];
    const presentDates = new Set(history.map(row => row.attendanceDate!));
    const known = member.created_at?.slice(0, 10) || rows.filter(row => row.personId === id).map(row => row.attendanceDate!).sort()[0];
    if (recentFour.length === 4 && known && known <= recentFour[0]) {
      eligibleMembers++;
      if (recentFour.filter(date => presentDates.has(date)).length >= 3) consistentMembers++;
    }
    const eligible = known ? dates.filter(date => date >= known).reverse() : [];
    let missed = 0;
    for (const date of eligible) { if (presentDates.has(date)) break; missed++; }
    if (missed >= 2) suggestions.push({ personRef: id, name: member.name, phone: member.phone, fellowship: member.fellowship, category: 'absence', reason: `${missed} consecutive recorded services missed` });
    if (eligible.length >= 3 && presentDates.has(eligible[0]) && !presentDates.has(eligible[1]) && !presentDates.has(eligible[2])) {
      returnedMembers.push({ name: member.name, fellowship: member.fellowship });
    }
    const birthday = nextBirthday(member.birthday, today);
    if (birthday && birthday.daysUntil <= 7) suggestions.push({ personRef: id, name: member.name, phone: member.phone, fellowship: member.fellowship, category: 'birthday', reason: birthday.daysUntil === 0 ? 'Birthday today' : `Birthday in ${birthday.daysUntil} days` });
  }
  const recentVisitors = [...firstVisits.values()].filter(row => row.attendanceDate! >= shift(today, -28));
  const eligibleVisitors = recentVisitors.filter(row => dates.some(date => date > row.attendanceDate!));
  const returnedVisitors = eligibleVisitors.filter(row => visits.get(row.personId)!.some(visit => visit.attendanceDate! > row.attendanceDate!));
  for (const row of recentVisitors) {
    if (visits.get(row.personId)!.some(visit => visit.attendanceDate! > row.attendanceDate!)) continue;
    suggestions.push({ personRef: row.personId, name: row.name, phone: row.phone, fellowship: row.fellowship, category: 'visitor', reason: `First visit ${row.attendanceDate}; no return recorded yet` });
  }
  return {
    asOf: today, latestDate, previousDate,
    daysSinceService: latestDate ? Math.floor((Date.parse(today) - Date.parse(latestDate)) / 86400000) : null,
    latestAttendance: latest.length, previousAttendance: previous.length,
    change: previousDate ? latest.length - previous.length : null,
    newVisitors: latest.filter(row => firstVisits.get(row.personId)?.attendanceDate === latestDate).length,
    returningVisitors: latest.filter(row => { const first = firstVisits.get(row.personId); return first && first.attendanceDate! < latestDate!; }).length,
    retention: { eligible: eligibleVisitors.length, returned: returnedVisitors.length, rate: eligibleVisitors.length ? Math.round(returnedVisitors.length / eligibleVisitors.length * 100) : null },
    consistency: { eligible: eligibleMembers, consistent: consistentMembers, rate: eligibleMembers ? Math.round(consistentMembers / eligibleMembers * 100) : null },
    returnedMembers, suggestions,
    timelines: Object.fromEntries(suggestions.map(person => [person.personRef, rows.filter(row => row.personId === person.personRef)
      .sort((a, b) => b.attendanceDate!.localeCompare(a.attendanceDate!)).slice(0, 12)
      .map(row => ({ date: row.attendanceDate!, status: row.attendanceStatus!, fellowship: row.fellowship }))])),
    dataQuality: active.filter(member => !member.phone?.trim() || !nextBirthday(member.birthday, today) || !member.fellowship?.trim() || member.fellowship === 'Unassigned')
      .map(member => ({ id: member.id, name: member.name, fellowship: member.fellowship, issues: [
        ...(!member.phone?.trim() ? ['Missing phone'] : []),
        ...(!nextBirthday(member.birthday, today) ? ['Missing / invalid birthday'] : []),
        ...(!member.fellowship?.trim() || member.fellowship === 'Unassigned' ? ['Unassigned fellowship'] : []),
      ] })),
    trend: dates.slice(-8).map(date => ({ date, attendance: presentRows.filter(row => row.attendanceDate === date).length })),
  };
}
export type PastoralInsights = ReturnType<typeof buildPastoralInsights>;
