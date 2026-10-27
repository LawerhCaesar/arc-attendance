import { getSupabaseAdmin } from './supabase-admin';
import { fetchAllRows } from './pagination';
import { dateInAccra } from './birthdays';
import { rosterAttendanceSummary, type ServiceCalendarRow } from './roster-attendance';
import type { HistoryAttendanceInput, HistoryMemberInput } from './fellowship-insights';
import { loadFellowshipHistoryRows } from './fellowship-history-source';

/** Call only after the owning report's authorization check. */
export async function loadRosterAttendanceSummary(scope?:string,includeArchived=true) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Roster attendance unavailable.');
  let memberQuery = admin.from('members').select('id,name,phone,fellowship,is_active,merged_into_id').is('merged_into_id',null).order('id');
  if (scope) memberQuery = memberQuery.eq('fellowship',scope);
  const membersPromise = fetchAllRows<HistoryMemberInput>((from,to) => memberQuery.range(from,to));
  const [members,rows,calendar] = await Promise.all([
    membersPromise,
    scope ? membersPromise.then(members => loadFellowshipHistoryRows(admin,members,scope)) :
      fetchAllRows<HistoryAttendanceInput>((from,to) => admin.from('attendance').select('id,member_id,name,phone,fellowship,date,attendanceDate,attendanceStatus').order('id').range(from,to)),
    // No other fellowship's identities are needed to share the service window.
    fetchAllRows<ServiceCalendarRow>((from,to) => admin.from('attendance').select('date,attendanceDate,attendanceStatus').order('id').range(from,to)),
  ]);
  const summary = rosterAttendanceSummary(members,rows,calendar,dateInAccra());
  if (!includeArchived) summary.members = Object.fromEntries(Object.entries(summary.members).filter(([,status])=>status.color!=='archived'));
  return summary;
}
