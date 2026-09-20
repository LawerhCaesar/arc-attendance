import { supabase } from './supabase';
import { matchFellowship } from './fellowships';

export interface AttendanceRecord {
  id?: string;
  date: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  firstTimer: string; // "Yes" or "No"
  designation?: string; // "Fellowship Leader" | "Cell Leader" | "BSCT Leader" | "Member"
  attendanceDate?: string;
  attendanceStatus?: string;
  createdAt?: Date;
  explicitToggle?: boolean;
}

export interface Member {
  id?: string;
  name: string;
  phone: string;
  fellowship: string;
  designation: string; // "Fellowship Leader" | "Cell Leader" | "BSCT Leader" | "Member"
  birthday: string;
  location: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DESIGNATIONS = [
  'Fellowship Leader',
  'Cell Leader',
  'BSCT Leader',
  'Member',
] as const;

export type Designation = typeof DESIGNATIONS[number];

const TABLE_NAME = 'attendance';
const MEMBERS_TABLE = 'members';

// ─── Attendance ───────────────────────────────────────────

export async function appendAttendance(record: AttendanceRecord): Promise<void> {
  const attendanceRecord = {
    ...record,
    fellowship: matchFellowship(record.fellowship),
    designation: record.designation || 'Member',
    createdAt: new Date().toISOString(),
  };

  const targetDate = record.attendanceDate || record.date;
  const dateField = record.attendanceDate ? 'attendanceDate' : 'date';

  // Check if record exists
  let existingQuery = supabase
    .from(TABLE_NAME)
    .select('id, attendanceStatus')
    .eq(dateField, targetDate)
    .limit(1);

  existingQuery = record.phone?.trim()
    ? existingQuery.eq('phone', record.phone.trim())
    : existingQuery.ilike('name', record.name).eq('fellowship', matchFellowship(record.fellowship));

  const { data: existing, error: fetchError } = await existingQuery;

  if (fetchError) {
    throw new Error(`Failed to check existing record: ${fetchError.message}`);
  }

  if (existing && existing.length > 0) {
    const existingRecord = existing[0];

    // Prevent overwriting a "present" status with "absent" unless explicitly requested
    if (
      existingRecord.attendanceStatus === 'present' &&
      attendanceRecord.attendanceStatus === 'absent' &&
      !record.explicitToggle
    ) {
      return; // Skip update
    }

    // Update existing record
    const { createdAt, explicitToggle, ...updatePayload } = attendanceRecord;
    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq('id', existingRecord.id);

    if (updateError) {
      throw new Error(`Failed to update record: ${updateError.message}`);
    }
  } else {
    // Insert new
    const { createdAt, explicitToggle, ...insertPayload } = attendanceRecord;
    const { error: insertError } = await supabase
      .from(TABLE_NAME)
      .insert([{ ...insertPayload, createdAt }]);

    if (insertError) {
      throw new Error(`Failed to insert record: ${insertError.message}`);
    }
  }
}

/** Get all attendance records from the database */
export async function getAttendanceData(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('date', { ascending: false })
    .order('createdAt', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch records: ${error.message}`);
  }

  return (data || []).map(record => ({
    ...record,
    designation: record.designation || 'Member',
    createdAt: record.createdAt ? new Date(record.createdAt) : undefined,
  } as AttendanceRecord));
}

/** Get attendance records filtered by date range */
export async function getAttendanceByDateRange(
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .order('date', { ascending: false })
    .order('createdAt', { ascending: false });

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch records by date range: ${error.message}`);
  }

  return (data || []).map(record => ({
    ...record,
    designation: record.designation || 'Member',
    createdAt: record.createdAt ? new Date(record.createdAt) : undefined,
  } as AttendanceRecord));
}

// ─── Members Roster ───────────────────────────────────────

/** Get all active members, optionally filtered by designation and/or fellowship */
export async function getMembers(
  designation?: string,
  fellowship?: string
): Promise<Member[]> {
  let query = supabase
    .from(MEMBERS_TABLE)
    .select('*')
    .eq('is_active', true)
    .order('fellowship')
    .order('name');

  if (designation) {
    if (designation.includes(',')) {
      const designationsList = designation.split(',').map(d => d.trim());
      query = query.in('designation', designationsList);
    } else {
      query = query.eq('designation', designation);
    }
  }
  if (fellowship) query = query.eq('fellowship', fellowship);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  return data || [];
}

const normalizedPhone = (value?: string) => (value || '').replace(/\D/g, '');
const normalizedText = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Find an active roster member using phone first, then name and fellowship. */
export async function findRosterMember(
  person: Pick<Member, 'name' | 'phone' | 'fellowship'>
): Promise<Member | null> {
  const phone = normalizedPhone(person.phone);

  if (person.phone?.trim()) {
    const { data: exactPhone, error: phoneError } = await supabase
      .from(MEMBERS_TABLE)
      .select('*')
      .eq('is_active', true)
      .eq('phone', person.phone.trim())
      .limit(1);
    if (phoneError) throw new Error(`Failed to check member roster: ${phoneError.message}`);
    if (exactPhone?.[0]) return exactPhone[0] as Member;
  }

  // Legacy phone values are not normalized, so compare a bounded active roster
  // locally after the fast exact-phone lookup. This catches spaces, dashes and
  // country-code formatting differences before falling back to name/fellowship.
  const { data: candidates, error: rosterError } = await supabase
    .from(MEMBERS_TABLE)
    .select('*')
    .eq('is_active', true)
    .limit(2000);
  if (rosterError) throw new Error(`Failed to check member roster: ${rosterError.message}`);

  const match = (candidates || []).find(candidate => {
    const candidatePhone = normalizedPhone(candidate.phone);
    if (phone && candidatePhone) return phone === candidatePhone;
    return normalizedText(candidate.name) === normalizedText(person.name) &&
      normalizedText(candidate.fellowship) === normalizedText(person.fellowship);
  });
  return (match as Member | undefined) || null;
}

export async function createMember(
  member: Omit<Member, 'id' | 'created_at' | 'updated_at'>
): Promise<Member> {
  const payload = { ...member, is_active: true };
  if (payload.fellowship !== undefined) {
    payload.fellowship = matchFellowship(payload.fellowship);
  }

  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create member: ${error.message}`);
  }

  return data;
}

/** Auto-sync Member from Attendance */
export async function syncMemberFromAttendance(record: AttendanceRecord, memberId?: string): Promise<void> {
  if (!record.name) return;

  if (memberId) {
    const updatePayload: Partial<Member> & { updated_at: string } = { updated_at: new Date().toISOString() };
    if (record.designation) updatePayload.designation = record.designation;
    if (record.phone) updatePayload.phone = record.phone;
    if (record.location) updatePayload.location = record.location;
    if (record.birthday) updatePayload.birthday = record.birthday;

    const { error } = await supabase.from(MEMBERS_TABLE).update(updatePayload).eq('id', memberId);
    if (error) throw new Error(`Failed to sync roster member: ${error.message}`);
    return;
  }

  // Imports may contain two different people with similar names. Only a stable
  // phone match is safe to update automatically; name/fellowship similarities
  // are left as separate records for the admin review queue.
  let existing: { id: string } | undefined;
  const recordPhone = normalizedPhone(record.phone);
  if (recordPhone) {
    const { data: candidates, error } = await supabase
      .from(MEMBERS_TABLE)
      .select('id, phone')
      .eq('is_active', true)
      .limit(2000);
    if (error) throw new Error(`Failed to check roster phone: ${error.message}`);
    existing = (candidates || []).find(candidate => normalizedPhone(candidate.phone) === recordPhone);
  }

  if (!existing) {
    await createMember({
      name: record.name,
      phone: record.phone || '',
      fellowship: matchFellowship(record.fellowship),
      designation: record.designation || 'Member',
      birthday: record.birthday || '',
      location: record.location || '',
    });
  } else {
    const updatePayload: any = {};
    if (record.designation) updatePayload.designation = record.designation;
    if (record.phone) updatePayload.phone = record.phone;
    if (record.location) updatePayload.location = record.location;
    if (record.birthday) updatePayload.birthday = record.birthday;
    
    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from(MEMBERS_TABLE)
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
  }
}

export async function updateMember(
  id: string,
  member: Partial<Omit<Member, 'id' | 'created_at' | 'updated_at'>>
): Promise<Member> {
  const payload = { ...member, updated_at: new Date().toISOString() };
  if (payload.fellowship !== undefined) {
    payload.fellowship = matchFellowship(payload.fellowship);
  }

  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update member: ${error.message}`);
  }

  return data;
}

/** Soft delete a member (set is_active = false) */
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase
    .from(MEMBERS_TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete member: ${error.message}`);
  }
}
