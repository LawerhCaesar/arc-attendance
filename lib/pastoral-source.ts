import { getAttendanceData, getMembers } from './database';
import { buildPastoralInsights } from './pastoral-insights';
import type { AuthContext } from './auth';

export async function loadPastoralInsights(context: AuthContext) {
  if (context.role === 'fellowship_leader' && !context.fellowship) throw new Error('No fellowship scope configured.');
  const [attendance, members] = await Promise.all([getAttendanceData({ preserveOverlaps: true }), getMembers()]);
  const scope = context.role === 'fellowship_leader' ? context.fellowship : null;
  return buildPastoralInsights(scope ? attendance.filter(row => row.fellowship === scope) : attendance,
    scope ? members.filter(row => row.fellowship === scope) : members);
}
