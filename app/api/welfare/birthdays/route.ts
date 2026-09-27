import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth';
import { dateInAccra, nextBirthday } from '@/lib/birthdays';
import { getMembers } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    if (!(await hasPermission('welfare'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedDays = Number(request.nextUrl.searchParams.get('days') || 60);
    const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 60, 1), 366);
    const today = dateInAccra();
    const members = await getMembers();
    const birthdays = members.flatMap(member => {
      const occurrence = nextBirthday(member.birthday || '', today);
      if (!occurrence || occurrence.daysUntil > days) return [];
      return [{
        id: member.id,
        name: member.name,
        phone: member.phone || '',
        fellowship: member.fellowship || 'Unassigned',
        birthday: member.birthday,
        nextBirthday: occurrence.nextDate,
        birthdayLabel: occurrence.display,
        daysUntil: occurrence.daysUntil,
      }];
    }).sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));

    return NextResponse.json({ today, windowDays: days, birthdays });
  } catch (error) {
    console.error('Error loading welfare birthdays:', error);
    return NextResponse.json({ error: 'Failed to load birthdays' }, { status: 500 });
  }
}
