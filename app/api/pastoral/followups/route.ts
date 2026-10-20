import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, type AuthContext } from '@/lib/auth';
import { canAccess, DEFAULT_PERMISSIONS } from '@/lib/permissions';
import { configuredUsers } from '@/lib/configured-users';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/pagination';
import { validateCareUpdate, type CareTask } from '@/lib/care-followups';
import { loadPastoralInsights } from '@/lib/pastoral-source';
import { isSuperAdmin } from '@/lib/super-admin';
import { canReadCare, canAssignCare, hasFellowshipCare } from '@/lib/care-access';
export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f-]{36}$/i;
async function owners(context: AuthContext) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Care follow-ups require server configuration.');
  type JoinedRole = { key: string; permissions: string[] };
  const accounts = await fetchAllRows<{ id: string; username: string; display_name: string; fellowship: string | null; configured_username: string | null; is_active: boolean; role: JoinedRole | JoinedRole[] }>((from, to) => admin.from('staff_accounts')
    .select('id,username,display_name,fellowship,configured_username,is_active,role:staff_roles(key,permissions)').order('username').range(from, to));
  const overridden = new Set(accounts.map(account => account.configured_username));
  const permitted = accounts.filter(account => {
    const role = Array.isArray(account.role) ? account.role[0] : account.role;
    const base = isSuperAdmin({ username: account.username, role: role?.key || '', accountId: account.id, configuredUsername: account.configured_username || undefined });
    return account.is_active && (base || role?.permissions.includes('overview') || role?.permissions.includes('care') || (role?.key === 'fellowship_leader' && role.permissions.includes('members'))) && (!account.fellowship || account.fellowship === context.fellowship || context.role !== 'fellowship_leader');
  }).map(account => ({ username: account.username, label: account.display_name, fellowship: account.fellowship }));
  const result = [...permitted, ...configuredUsers().filter(user => !overridden.has(user.username.toLowerCase()) && (DEFAULT_PERMISSIONS[user.role].some(permission => permission === 'overview' || permission === 'care') || user.role === 'fellowship_leader')).map(user => ({ username: user.username, label: user.username, fellowship: user.fellowship || null }))];
  return canAccess(context, 'overview') && context.role !== 'fellowship_leader' ? result : result.filter(owner => owner.username === context.username);
}
const unavailable = () => NextResponse.json({ error: 'Follow-ups are unavailable. Check server configuration and apply the pastoral follow-ups migration.' }, { status: 503 });
export async function GET() {
  const context = await getAuthContext();
  if (!context || !canReadCare(context)) return NextResponse.json({ error: 'Follow-up access required.' }, { status: context ? 403 : 401 });
  if (context.role === 'fellowship_leader' && !context.fellowship) return NextResponse.json({ error: 'No fellowship scope configured.' }, { status: 403 });
  try {
    const admin = getSupabaseAdmin(); if (!admin) return unavailable();
    const tasks = await fetchAllRows<CareTask>((from, to) => {
      let query = admin.from('pastoral_followups').select('*').order('due_date').order('id');
      if (!canAccess(context, 'overview') || hasFellowshipCare(context)) query = query.eq('owner', context.username);
      if (context.role === 'fellowship_leader') query = query.eq('fellowship', context.fellowship!);
      return query.range(from, to);
    });
    return NextResponse.json({ tasks, owners: await owners(context), username: context.username }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return unavailable(); }
}
async function save(request: NextRequest, editing: boolean) {
  const context = await getAuthContext();
  if (!context || !canReadCare(context)) return NextResponse.json({ error: 'Follow-up access required.' }, { status: context ? 403 : 401 });
  if (!editing && !canAssignCare(context)) return NextResponse.json({ error: 'Care assignment access is required.' }, { status: 403 });
  if (context.role === 'fellowship_leader' && !context.fellowship) return NextResponse.json({ error: 'No fellowship scope configured.' }, { status: 403 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-site changes are not allowed.' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  let values;
  try { values = validateCareUpdate(body); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const admin = getSupabaseAdmin(); if (!admin) return unavailable();
    const owner = (await owners(context)).find(item => item.username === values.owner);
    if (!owner) return NextResponse.json({ error: 'Choose an active account with Care Centre or follow-up access.' }, { status: 400 });
    let query;
    if (editing) {
      if (typeof body.id !== 'string' || !uuid.test(body.id) || typeof body.updated_at !== 'string') return NextResponse.json({ error: 'Select a valid follow-up.' }, { status: 400 });
      const { data: task, error } = await admin.from('pastoral_followups').select('*').eq('id', body.id).maybeSingle();
      if (error) return unavailable();
      if (!task || ((!canAccess(context, 'overview') || context.role === 'fellowship_leader') && task.owner !== context.username) || (context.role === 'fellowship_leader' && task.fellowship !== context.fellowship)) return NextResponse.json({ error: 'Follow-up not found.' }, { status: 404 });
      if (owner.fellowship && owner.fellowship !== task.fellowship) return NextResponse.json({ error: 'This owner is restricted to a different fellowship.' }, { status: 400 });
      query = admin.from('pastoral_followups').update({ ...values, updated_by: context.username,
        completed_at: values.status === 'completed' ? task.completed_at || new Date().toISOString() : null,
      }).eq('id', body.id).eq('updated_at', body.updated_at);
    } else {
      if (values.status !== 'open') return NextResponse.json({ error: 'New follow-ups must start open.' }, { status: 400 });
      const insights = await loadPastoralInsights(context);
      const person = insights.suggestions.find(item => item.personRef === body.person_ref && item.category === body.category);
      if (!person) return NextResponse.json({ error: 'This suggestion changed. Refresh and try again.' }, { status: 409 });
      if (owner.fellowship && owner.fellowship !== person.fellowship) return NextResponse.json({ error: 'This owner is restricted to a different fellowship.' }, { status: 400 });
      query = admin.from('pastoral_followups').insert({ ...values, person_ref: person.personRef, name: person.name, phone: person.phone,
        fellowship: person.fellowship, category: person.category, reason: person.reason, created_by: context.username, updated_by: context.username });
    }
    const { data, error } = await query.select('*').maybeSingle();
    if (error?.code === '23505') return NextResponse.json({ error: 'An open follow-up already exists for this person and category.' }, { status: 409 });
    if (error) return unavailable();
    if (!data) return NextResponse.json({ error: 'Another staff member updated this follow-up. Refresh before saving.' }, { status: 409 });
    return NextResponse.json({ task: data }, { status: editing ? 200 : 201 });
  } catch { return unavailable(); }
}
export const POST = (request: NextRequest) => save(request, false);
export const PATCH = (request: NextRequest) => save(request, true);
