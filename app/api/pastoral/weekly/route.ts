import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { loadPastoralInsights } from '@/lib/pastoral-source';
export const dynamic = 'force-dynamic';
export async function GET() {
  const context = await getAuthContext();
  if (!context || !canAccess(context, 'overview')) return NextResponse.json({ error: 'Overview access required.' }, { status: context ? 403 : 401 });
  try {
    return NextResponse.json(await loadPastoralInsights(context), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Weekly overview could not be loaded. Please retry.' }, { status: 503 });
  }
}
