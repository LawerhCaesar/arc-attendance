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
  const { data: existing, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('id')
    .ilike('name', record.name)
    .eq(dateField, targetDate)
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to check existing record: ${fetchError.message}`);
  }

  if (existing && existing.length > 0) {
    // Update existing record
    const { createdAt, ...updatePayload } = attendanceRecord;
    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq('id', existing[0].id);

    if (updateError) {
      throw new Error(`Failed to update record: ${updateError.message}`);
    }
  } else {
    // Insert new
    const { error: insertError } = await supabase
      .from(TABLE_NAME)
      .insert([attendanceRecord]);

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
export async function syncMemberFromAttendance(record: AttendanceRecord): Promise<void> {
  if (!record.name) return;
  
  let query = supabase
    .from(MEMBERS_TABLE)
    .select('id')
    .ilike('name', record.name);

  if (record.fellowship) {
    query = query.eq('fellowship', matchFellowship(record.fellowship));
  }

  const { data: existing } = await query.maybeSingle();

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
