export const CARE_STATUSES = ['open', 'in_progress', 'completed', 'dismissed'] as const;
export interface CareTask {
  id: string; person_ref: string; name: string; phone: string; fellowship: string;
  category: string; reason: string; owner: string; due_date: string;
  priority: 'normal' | 'high'; status: typeof CARE_STATUSES[number]; outcome: string;
  created_at: string; updated_at: string; completed_at: string | null;
}
export function validateCareUpdate(body: Record<string, unknown>) {
  if (typeof body.owner !== 'string' || !body.owner.trim() || body.owner.length > 100) throw new Error('Choose an owner.');
  if (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ||
    !Number.isFinite(Date.parse(body.due_date)) || new Date(body.due_date).toISOString().slice(0, 10) !== body.due_date) throw new Error('Choose a valid due date.');
  if (!CARE_STATUSES.includes(body.status as CareTask['status'])) throw new Error('Choose a valid status.');
  if (body.priority !== 'normal' && body.priority !== 'high') throw new Error('Choose a valid priority.');
  if (typeof body.outcome !== 'string' || body.outcome.length > 1000) throw new Error('Keep the outcome under 1,000 characters.');
  if (['completed', 'dismissed'].includes(String(body.status)) && !body.outcome.trim()) throw new Error('Record a brief outcome before closing this follow-up.');
  return { owner: body.owner.trim(), due_date: body.due_date, status: body.status as CareTask['status'], priority: body.priority, outcome: body.outcome.trim() };
}
export function careCounts(tasks: CareTask[], today: string) {
  const open = tasks.filter(task => task.status === 'open' || task.status === 'in_progress');
  return { open: open.length, overdue: open.filter(task => task.due_date < today).length,
    dueToday: open.filter(task => task.due_date === today).length, completed: tasks.filter(task => task.status === 'completed').length };
}
