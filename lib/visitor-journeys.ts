import type { AttendanceRecord } from './database';
import { getSupabaseAdmin } from './supabase-admin';

const phoneDigits = (value?: string) => (value || '').replace(/\D/g, '');

function birthdayParts(value?: string): { birth_day?: number; birth_month?: number } {
  if (!value) return {};
  const iso = value.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  const dayFirst = value.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (iso) return { birth_month: Number(iso[1]), birth_day: Number(iso[2]) };
  if (dayFirst) return { birth_day: Number(dayFirst[1]), birth_month: Number(dayFirst[2]) };
  return {};
}

/**
 * Mirrors a newly detected visitor into the normalized journey tables when the
 * additive foundation migration and service-role key are available.
 * Legacy attendance remains the source of truth during rollout.
 */
export async function recordFirstTimerJourney(record: AttendanceRecord): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  try {
    const phone = phoneDigits(record.phone);
    let person: { id: string } | null = null;

    if (phone) {
      const { data } = await admin
        .from('people')
        .select('id')
        .eq('normalized_phone', phone)
        .maybeSingle();
      person = data;
    }

    if (!person) {
      const { data } = await admin
        .from('people')
        .select('id')
        .ilike('full_name', record.name.trim())
        .limit(1)
        .maybeSingle();
      person = data;
    }

    let fellowshipId: string | null = null;
    if (record.fellowship) {
      const { data: fellowship } = await admin
        .from('fellowships')
        .select('id')
        .eq('name', record.fellowship)
        .maybeSingle();
      fellowshipId = fellowship?.id || null;
    }

    if (!person) {
      const { data, error } = await admin
        .from('people')
        .insert({
          full_name: record.name.trim(),
          phone: record.phone || null,
          normalized_phone: phone || null,
          location: record.location || null,
          fellowship_id: fellowshipId,
          lifecycle_status: 'visitor',
          first_visit_at: record.attendanceDate || record.date,
          ...birthdayParts(record.birthday),
        })
        .select('id')
        .single();
      if (error) throw error;
      person = data;
    }

    const { error: journeyError } = await admin
      .from('visitor_journeys')
      .upsert({ person_id: person.id, stage: 'new' }, { onConflict: 'person_id', ignoreDuplicates: true });
    if (journeyError) throw journeyError;
  } catch (error) {
    // Attendance must still succeed while the additive migration is rolling out.
    console.warn('Could not mirror first timer into visitor journey tables:', error);
  }
}
