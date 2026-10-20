import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { loadPastoralInsights } from '@/lib/pastoral-source';
import { hasFellowshipCare } from '@/lib/care-access';
export const dynamic = 'force-dynamic';
export async function GET() {
  const context = await getAuthContext();
  if (!context || !(context.role === 'fellowship_leader' ? hasFellowshipCare(context) : canAccess(context, 'overview'))) return NextResponse.json({ error: 'Care Centre access required.' }, { status: context ? 403 : 401 });
  try {
    return NextResponse.json(await loadPastoralInsights(context), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Weekly overview could not be loaded. Please retry.' }, { status: 503 });
  }
}
