import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth';
import { getAttendanceData } from '@/lib/database';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const STAGES = ['new', 'contacted', 'invited_back', 'returned', 'fellowship_assigned', 'member', 'closed'] as const;
type Stage = (typeof STAGES)[number];

const phoneDigits = (value?: string) => (value || '').replace(/\D/g, '');
const normalizedText = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const personKey = (person: { name: string; phone?: string; fellowship?: string }) => {
  const phone = phoneDigits(person.phone);
  return phone.length >= 7 ? `phone:${phone}` : `name:${person.name.trim().toLowerCase()}|${(person.fellowship || '').trim().toLowerCase()}`;
};

async function legacyJourneys() {
  const attendance = await getAttendanceData();
  const firstVisits = new Map<string, (typeof attendance)[number]>();
  attendance
    .filter(record => ['yes', 'true', '1'].includes(String(record.firstTimer || '').toLowerCase()))
    .sort((a, b) => (a.attendanceDate || a.date).localeCompare(b.attendanceDate || b.date))
    .forEach(record => {
      const key = personKey(record);
      if (!firstVisits.has(key)) firstVisits.set(key, record);
    });

  return Array.from(firstVisits.entries()).map(([key, record]) => {
    const visitDate = record.attendanceDate || record.date;
    const returned = attendance.some(item =>
      personKey(item) === key &&
      (item.attendanceStatus === 'present' || !item.attendanceStatus) &&
      (item.attendanceDate || item.date) > visitDate
    );
    return {
      id: null,
      personId: null,
      name: record.name,
      phone: record.phone || '',
      fellowship: record.fellowship || 'Unassigned',
      location: record.location || '',
      firstVisitDate: visitDate,
      stage: returned ? 'returned' : 'new',
      nextFollowUpAt: null,
      lastContactedAt: null,
      outcome: '',
      readOnly: true,
    };
  }).sort((a, b) => b.firstVisitDate.localeCompare(a.firstVisitDate));
}

export async function GET() {
  try {
    if (!(await hasPermission('first-timers'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ journeys: await legacyJourneys(), source: 'legacy' });
    }

    const { data, error } = await admin
      .from('visitor_journeys')
      .select('id, stage, next_follow_up_at, last_contacted_at, outcome, person:people(id, full_name, phone, location, first_visit_at, fellowship:fellowships(name))')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Visitor journey tables unavailable, using legacy attendance:', error.message);
      return NextResponse.json({ journeys: await legacyJourneys(), source: 'legacy' });
    }

    const journeys = (data || []).map((row: any) => {
      const person = Array.isArray(row.person) ? row.person[0] : row.person;
      const fellowship = Array.isArray(person?.fellowship) ? person.fellowship[0] : person?.fellowship;
      return {
        id: row.id,
        personId: person?.id,
        name: person?.full_name || 'Unknown visitor',
        phone: person?.phone || '',
        fellowship: fellowship?.name || 'Unassigned',
        location: person?.location || '',
        firstVisitDate: person?.first_visit_at || '',
        stage: row.stage,
        nextFollowUpAt: row.next_follow_up_at,
        lastContactedAt: row.last_contacted_at,
        outcome: row.outcome || '',
        readOnly: false,
      };
    });

    return NextResponse.json({ journeys, source: 'normalized' });
  } catch (error) {
    console.error('Error loading first timer journeys:', error);
    return NextResponse.json({ error: 'Failed to load first timer progression' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await hasPermission('first-timers'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' }, { status: 503 });
    }

    const body = await request.json();
    const id = String(body.id || '');
    const stage = body.stage as Stage;
    if (!id || !STAGES.includes(stage)) {
      return NextResponse.json({ error: 'A valid journey and stage are required' }, { status: 400 });
    }

    const update: Record<string, string | null> = { stage };
    if ('nextFollowUpAt' in body) update.next_follow_up_at = body.nextFollowUpAt || null;
    if ('outcome' in body) update.outcome = String(body.outcome || '').slice(0, 2000);
    if (stage === 'contacted') update.last_contacted_at = new Date().toISOString();

    const { data: currentJourney, error: journeyError } = await admin
      .from('visitor_journeys')
      .select('id, stage, person:people(*)')
      .eq('id', id)
      .single();
    if (journeyError) throw journeyError;

    if (stage === 'member') {
      const person = Array.isArray((currentJourney as any).person) ? (currentJourney as any).person[0] : (currentJourney as any).person;
      if (person) {
        const { data: activeMembers, error: memberLookupError } = await admin
          .from('members')
          .select('id, name, phone')
          .eq('is_active', true)
          .limit(2000);
        if (memberLookupError) throw memberLookupError;
        const normalizedPersonPhone = phoneDigits(person.phone);
        const existing = (activeMembers || []).find(member =>
          (normalizedPersonPhone && phoneDigits(member.phone) === normalizedPersonPhone) ||
          normalizedText(member.name) === normalizedText(person.full_name)
        );
        if (!existing) {
          let fellowshipName = 'Unassigned';
          if (person.fellowship_id) {
            const { data: fellowship } = await admin.from('fellowships').select('name').eq('id', person.fellowship_id).maybeSingle();
            fellowshipName = fellowship?.name || fellowshipName;
          }
          const { error: memberInsertError } = await admin.from('members').insert({
            name: person.full_name,
            phone: person.phone || '',
            fellowship: fellowshipName,
            designation: 'Member',
            birthday: person.birth_day && person.birth_month
              ? `${String(person.birth_day).padStart(2, '0')}-${String(person.birth_month).padStart(2, '0')}`
              : '',
            location: person.location || '',
            is_active: true,
          });
          if (memberInsertError) throw memberInsertError;
        }
        const { error: personUpdateError } = await admin
          .from('people')
          .update({ lifecycle_status: 'member', joined_at: new Date().toISOString().slice(0, 10) })
          .eq('id', person.id);
        if (personUpdateError) throw personUpdateError;
      }
    }

    const { error: updateError } = await admin
      .from('visitor_journeys')
      .update(update)
      .eq('id', id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, id, stage });
  } catch (error) {
    console.error('Error updating first timer journey:', error);
    return NextResponse.json({ error: 'Failed to update first timer progression' }, { status: 500 });
  }
}
