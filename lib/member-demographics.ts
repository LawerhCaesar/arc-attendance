import type { Member } from './database';
import { dateInAccra, nextBirthday } from './birthdays';

export function buildMemberDemographics(members: Member[], now = new Date()) {
  const active = members.filter(member => member.is_active !== false);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const birthdays = monthNames.map(month => ({ month, count: 0 }));
  const locations = new Map<string, number>();
  let missingBirthdays = 0;
  let invalidBirthdays = 0;
  const today = dateInAccra(now);
  for (const member of active) {
    const location = member.location?.trim() || 'Unknown';
    locations.set(location, (locations.get(location) || 0) + 1);
    if (!member.birthday?.trim()) { missingBirthdays += 1; continue; }
    const birthday = nextBirthday(member.birthday, today);
    if (!birthday) { invalidBirthdays += 1; continue; }
    birthdays[birthday.month - 1].count += 1;
  }
  return {
    locations: Array.from(locations, ([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count),
    birthdays,
    totalMembers: active.length,
    validBirthdays: birthdays.reduce((sum, item) => sum + item.count, 0),
    missingBirthdays,
    invalidBirthdays,
  };
}
