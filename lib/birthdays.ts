export interface BirthdayOccurrence {
  day: number;
  month: number;
  nextDate: string;
  daysUntil: number;
  display: string;
}

export function dateInAccra(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function nextBirthday(value: string, todayIso: string): BirthdayOccurrence | null {
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
  const validationDate = new Date(Date.UTC(2000, month - 1, day));
  if (validationDate.getUTCMonth() !== month - 1 || validationDate.getUTCDate() !== day) return null;

  const [year, todayMonth, todayDay] = todayIso.split('-').map(Number);
  const today = Date.UTC(year, todayMonth - 1, todayDay);
  let birthdayYear = year;
  let birthday = Date.UTC(birthdayYear, month - 1, day);
  if (birthday < today) {
    birthdayYear += 1;
    birthday = Date.UTC(birthdayYear, month - 1, day);
  }

  const nextDate = `${birthdayYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    day,
    month,
    nextDate,
    daysUntil: Math.round((birthday - today) / 86_400_000),
    display: new Date(birthday).toLocaleDateString('en-GB', {
      timeZone: 'UTC', day: 'numeric', month: 'long',
    }),
  };
}
