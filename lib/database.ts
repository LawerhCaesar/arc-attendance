import { supabase } from './supabase';

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

/** Add a new attendance record to the database */
export async function appendAttendance(record: AttendanceRecord): Promise<void> {
  const attendanceRecord = {
    ...record,
    designation: record.designation || 'Member',
    createdAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .insert([attendanceRecord]);

  if (error) {
    throw new Error(`Failed to insert record: ${error.message}`);
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

  if (designation) query = query.eq('designation', designation);
  if (fellowship) query = query.eq('fellowship', fellowship);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  return data || [];
}

/** Create a new member */
export async function createMember(
  member: Omit<Member, 'id' | 'created_at' | 'updated_at'>
): Promise<Member> {
  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .insert([{ ...member, is_active: true }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create member: ${error.message}`);
  }

  return data;
}

/** Update an existing member */
export async function updateMember(
  id: string,
  member: Partial<Omit<Member, 'id' | 'created_at' | 'updated_at'>>
): Promise<Member> {
  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .update({ ...member, updated_at: new Date().toISOString() })
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
