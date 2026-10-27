import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoryAttendanceInput, HistoryMemberInput } from './fellowship-insights';
import { fetchAllRows } from './pagination';

const columns = 'id,member_id,name,phone,fellowship,date,attendanceDate,attendanceStatus';

/** Keep the original service fellowship on stored attendance. An intake from
 * Unassigned can still see their own linked history in the new roster.
 * Only IDs from the authorized fellowship roster may be supplied here.
 */
export async function loadFellowshipHistoryRows(admin: SupabaseClient, members: HistoryMemberInput[], fellowship: string) {
  const rows = await fetchAllRows<HistoryAttendanceInput>((from, to) => admin.from('attendance')
    .select(columns).eq('fellowship', fellowship).order('id').range(from, to));
  const ids = members.filter(member => member.fellowship === fellowship && member.id && member.is_active !== false && !member.merged_into_id).map(member => member.id!);
  for (let offset = 0; offset < ids.length; offset += 100) {
    rows.push(...await fetchAllRows<HistoryAttendanceInput>((from, to) => admin.from('attendance')
      .select(columns).eq('fellowship', 'Unassigned').in('member_id', ids.slice(offset, offset + 100)).order('id').range(from, to)));
  }
  return rows;
}
