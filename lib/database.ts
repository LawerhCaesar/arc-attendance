import { supabase } from './supabase';
import { matchFellowship } from './fellowships';
import { fetchAllRows } from './pagination';
import { consolidateLinkedAttendance, matchesRosterMember, normalizePhone } from './attendance-identity';
import { getSupabaseAdmin } from './supabase-admin';
import { returningArchivedMember } from './returning-member';

export interface AttendanceRecord {
  id?: string;
  member_id?: string | null;
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
  cell_id?: string | null;
  bsct_group_id?: string | null;
  is_active?: boolean;
  merged_into_id?: string | null;
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
    .eq(dateField, targetDate);

  existingQuery = record.member_id
    ? existingQuery.eq('member_id', record.member_id)
    : record.phone?.trim()
    ? existingQuery.eq('phone', record.phone.trim())
    : existingQuery.ilike('name', record.name).eq('fellowship', matchFellowship(record.fellowship));

  let existing = await fetchAllRows<{ id: string; attendanceStatus: string }>(
    (from, to) => existingQuery.order('id').range(from, to),
  );
  if (record.member_id && existing.length === 0) {
    // Reuse pre-migration entries on this service before inserting a linked row.
    const legacy = await fetchAllRows<AttendanceRecord>((from, to) => supabase.from(TABLE_NAME)
      .select('*').is('member_id', null).eq(dateField, targetDate).order('id').range(from, to));
    existing = legacy.filter(row => matchesRosterMember(row, { ...record, id: record.member_id || undefined }))
      .map(row => ({ id: row.id!, attendanceStatus: row.attendanceStatus || '' }));
  }

  if (existing && existing.length > 0) {
    // Prevent overwriting a "present" status with "absent" unless explicitly requested
    if (
      existing.some(item => item.attendanceStatus === 'present' || !item.attendanceStatus) &&
      attendanceRecord.attendanceStatus === 'absent' &&
      !record.explicitToggle
    ) {
      return; // Skip update
    }

    // Update existing record
    const { createdAt, explicitToggle, ...updatePayload } = attendanceRecord;
    for (let start = 0; start < existing.length; start += 100) {
      const { error: updateError } = await supabase.from(TABLE_NAME).update(updatePayload)
        .in('id', existing.slice(start, start + 100).map(row => row.id));
      if (updateError) throw updateError;
    }
  } else {
    // Insert new
    const { createdAt, explicitToggle, ...insertPayload } = attendanceRecord;
    const { error: insertError } = await supabase
      .from(TABLE_NAME)
      .insert([{ ...insertPayload, createdAt }]);

    if (insertError) {
      throw insertError;
    }
  }
}

/** Get all attendance records from the database */
export async function getAttendanceData(options: { preserveOverlaps?: boolean } = {}): Promise<AttendanceRecord[]> {
  const data = await fetchAllRows<AttendanceRecord>((from, to) => supabase
    .from(TABLE_NAME)
    .select('*')
    .order('date', { ascending: false })
    .order('createdAt', { ascending: false }).order('id').range(from, to));

  return (options.preserveOverlaps ? data : consolidateLinkedAttendance(data)).map(record => ({
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
    .order('createdAt', { ascending: false }).order('id');

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const data = await fetchAllRows<AttendanceRecord>((from, to) => query.range(from, to));

  return consolidateLinkedAttendance(data).map(record => ({
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
    .order('name').order('id');

  if (designation) {
    if (designation.includes(',')) {
      const designationsList = designation.split(',').map(d => d.trim());
      query = query.in('designation', designationsList);
    } else {
      query = query.eq('designation', designation);
    }
  }
  if (fellowship) query = query.eq('fellowship', fellowship);

  return fetchAllRows<Member>((from, to) => query.range(from, to));
}

/** Fetch one active member within the caller's permitted fellowship. */
export async function getMember(id: string, fellowshipScope?: string): Promise<Member | null> {
  let query = supabase.from(MEMBERS_TABLE).select('*').eq('id', id).eq('is_active', true);
  if (fellowshipScope) query = query.eq('fellowship', fellowshipScope);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

const normalizedPhone = normalizePhone;

/** Find an active roster member using phone first, then name and fellowship. */
export async function findRosterMember(
  person: Pick<Member, 'name' | 'phone' | 'fellowship'>,
  fellowshipScope?: string,
): Promise<Member | null> {
  const phone = normalizedPhone(person.phone);

  if (person.phone?.trim()) {
    let phoneQuery = supabase
      .from(MEMBERS_TABLE)
      .select('*')
      .eq('is_active', true)
      .eq('phone', person.phone.trim())
      .limit(1);
    if (fellowshipScope) phoneQuery = phoneQuery.eq('fellowship', fellowshipScope);
    const { data: exactPhone, error: phoneError } = await phoneQuery;
    if (phoneError) throw new Error(`Failed to check member roster: ${phoneError.message}`);
    if (exactPhone?.[0]) return exactPhone[0] as Member;
  }

  // Legacy phone values are not normalized, so compare the complete active roster
  // locally after the fast exact-phone lookup. This catches spaces, dashes and
  // country-code formatting differences before falling back to name/fellowship.
  const candidates = await getMembers(undefined, fellowshipScope);

  const match = (candidates || []).find(candidate => {
    const candidatePhone = normalizedPhone(candidate.phone);
    if (phone && candidatePhone && phone === candidatePhone) return true;
    return matchesRosterMember(person, candidate);
  });
  if (match) return match;

  // Old names/contacts remain valid aliases after an admin-approved merge.
  let aliasQuery = supabase.from(MEMBERS_TABLE).select('*').not('merged_into_id', 'is', null).order('id');
  if (fellowshipScope) aliasQuery = aliasQuery.eq('fellowship', fellowshipScope);
  const aliases = await fetchAllRows<Member>((from, to) => aliasQuery.range(from, to));
  const alias = aliases.find(candidate => matchesRosterMember(person, candidate));
  return candidates.find(candidate => candidate.id === alias?.merged_into_id) || null;
}

/** Include archived identities without exposing them in the public roster.
 * The attendance trigger restores a matched identity only on a present write.
 */
export async function findAttendanceRosterMember(person: Pick<Member, 'name' | 'phone' | 'fellowship'>, fellowshipScope?: string): Promise<Member | null> {
  let query = (getSupabaseAdmin() || supabase).from(MEMBERS_TABLE).select('*')
    .eq('is_active', false).is('merged_into_id', null).order('id');
  if (fellowshipScope || person.fellowship) query = query.eq('fellowship', fellowshipScope || matchFellowship(person.fellowship));
  const archived = await fetchAllRows<Member>((from, to) => query.range(from, to));
  const canonical = { ...person, fellowship: person.fellowship ? matchFellowship(person.fellowship) : '' };
  return returningArchivedMember(canonical, archived) || findRosterMember(person, fellowshipScope);
}

export async function createMember(
  member: Omit<Member, 'id' | 'created_at' | 'updated_at'>
): Promise<Member> {
  const payload = { ...member, is_active: true };
  if (payload.fellowship !== undefined) {
    payload.fellowship = matchFellowship(payload.fellowship);
  }

  const { data, error } = await (getSupabaseAdmin() || supabase)
    .from(MEMBERS_TABLE)
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/** Import in one transaction: a duplicate phone rejects the whole file. */
export async function createMembers(members: Omit<Member, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
  if (!members.length) return;
  const { error } = await (getSupabaseAdmin() || supabase).from(MEMBERS_TABLE).insert(members.map(member => ({
    ...member, fellowship: matchFellowship(member.fellowship), is_active: true,
  })));
  if (error) throw error;
}

/** Auto-sync Member from Attendance */
export async function syncMemberFromAttendance(record: AttendanceRecord, memberId?: string, fellowshipScope?: string): Promise<void> {
  if (!record.name) return;
  if (fellowshipScope && record.fellowship !== fellowshipScope) throw new Error('Outside your fellowship scope');
  const client = getSupabaseAdmin() || supabase;

  if (memberId) {
    const updatePayload: Partial<Member> & { updated_at: string } = { updated_at: new Date().toISOString() };
    if (record.designation) updatePayload.designation = record.designation;
    if (record.phone) updatePayload.phone = record.phone;
    if (record.location) updatePayload.location = record.location;
    if (record.birthday) updatePayload.birthday = record.birthday;

    let query = client.from(MEMBERS_TABLE).update(updatePayload).eq('id', memberId).eq('is_active', true);
    if (fellowshipScope) query = query.eq('fellowship', fellowshipScope);
    const { error } = await query;
    if (error) throw error;
    return;
  }

  // Imports may contain two different people with similar names. Only a stable
  // phone match is safe to update automatically; name/fellowship similarities
  // are left as separate records for the admin review queue.
  let existing: { id: string } | undefined;
  const recordPhone = normalizedPhone(record.phone);
  if (recordPhone) {
    const candidates = await getMembers(undefined, fellowshipScope);
    existing = candidates.find(candidate => normalizedPhone(candidate.phone) === recordPhone) as { id: string } | undefined;
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
      let query = client
        .from(MEMBERS_TABLE)
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq('id', existing.id).eq('is_active', true);
      if (fellowshipScope) query = query.eq('fellowship', fellowshipScope);
      const { error } = await query;
      if (error) throw error;
    }
  }
}

export async function updateMember(
  id: string,
  member: Partial<Omit<Member, 'id' | 'created_at' | 'updated_at'>>,
  fellowshipScope?: string,
): Promise<Member | null> {
  const payload = { ...member, updated_at: new Date().toISOString() };
  if (payload.fellowship !== undefined) {
    payload.fellowship = matchFellowship(payload.fellowship);
  }

  let query = (getSupabaseAdmin() || supabase)
    .from(MEMBERS_TABLE)
    .update(payload)
    .eq('id', id).eq('is_active', true);
  if (fellowshipScope) query = query.eq('fellowship', fellowshipScope);
  const { data, error } = await query
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/** Soft delete a member (set is_active = false) */
export async function deleteMember(id: string, fellowshipScope?: string): Promise<boolean> {
  let query = (getSupabaseAdmin() || supabase)
    .from(MEMBERS_TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id).eq('is_active', true);
  if (fellowshipScope) query = query.eq('fellowship', fellowshipScope);
  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    throw error;
  }
  return Boolean(data);
}
