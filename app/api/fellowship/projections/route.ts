import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { memberApiFailure } from '@/lib/member-api';
import { MemberInputError, memberFellowshipScope, memberUuid } from '@/lib/member-scope';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { dateInAccra } from '@/lib/birthdays';
import { fetchAllRows } from '@/lib/pagination';
import { FELLOWSHIPS } from '@/lib/fellowships';
import { compareSundayProjection, projectionSunday, upcomingSunday, type SundayProjection } from '@/lib/attendance-projections';
import type { Member, AttendanceRecord } from '@/lib/database';

export const dynamic = 'force-dynamic';
async function access() {
  const context = await getAuthContext();
  if (!context) throw new MemberInputError('Sign in to view Sunday attendance projections.',401);
  if (context.role === 'fellowship_leader' ? !canAccess(context,'members') : !canAccess(context,'overview','fellowship-services')) throw new MemberInputError('Fellowship reporting access required.',403);
  const scope = memberFellowshipScope(context);
  const admin = getSupabaseAdmin(); if (!admin) throw new Error('Projection service unavailable.');
  return { context, scope, admin };
}
export async function GET(request: NextRequest) {
  try {
    const { context, scope, admin } = await access();
    const today = dateInAccra();
    const serviceDate = projectionSunday(request.nextUrl.searchParams.get('date') || upcomingSunday(today));
    let memberQuery = admin.from('members').select('*').order('id');
    let attendanceQuery = admin.from('attendance').select('*').order('id');
    let projectionQuery = admin.from('fellowship_sunday_projections').select('*').eq('service_date',serviceDate).order('fellowship');
    if (scope) { memberQuery = memberQuery.eq('fellowship',scope); attendanceQuery = attendanceQuery.eq('fellowship',scope); projectionQuery = projectionQuery.eq('fellowship',scope); }
    const [members,rows,projections] = await Promise.all([
      fetchAllRows<Member>((from,to) => memberQuery.range(from,to)),
      fetchAllRows<AttendanceRecord>((from,to) => attendanceQuery.range(from,to)),
      fetchAllRows<SundayProjection>((from,to) => projectionQuery.range(from,to)),
    ]);
    const comparisons = (scope ? [scope] : FELLOWSHIPS).map(fellowship => compareSundayProjection(members,rows,projections.find(item => item.fellowship === fellowship) || null,fellowship,serviceDate,today));
    return NextResponse.json({ serviceDate,today,fellowshipScope:scope || null,canEdit:context.role === 'fellowship_leader' && !comparisons[0].locked,comparisons },{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return memberApiFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const { context, scope, admin } = await access();
    if (context.role !== 'fellowship_leader' || !scope) throw new MemberInputError('Only fellowship leaders can submit their fellowship projection.',403);
    const body = await request.json().catch(() => null);
    const serviceDate = projectionSunday(body?.serviceDate);
    if (body.fellowship && body.fellowship !== scope) throw new MemberInputError('You can only project attendance for your assigned fellowship.',403);
    if (!Array.isArray(body.memberIds) || body.memberIds.length>10000 || body.memberIds.some((id:unknown) => typeof id !== 'string' || !memberUuid.test(id)) || !Number.isInteger(body.revision) || body.revision<0 || body.revision>2147483647) throw new MemberInputError('Select valid brethren and refresh the projection before saving.');
    const { data,error } = await admin.rpc('save_fellowship_sunday_projection',{ p_service_date:serviceDate,p_fellowship:scope,p_member_ids:[...new Set(body.memberIds)],p_expected_revision:body.revision,p_updated_by:context.username });
    if (error?.code === '40001') throw new MemberInputError(error.message,409);
    if (error?.code === 'P0001' || error?.code === '23514') throw new MemberInputError(error.message);
    if (error) throw error;
    return NextResponse.json({message:'Sunday projection saved.',revision:data.revision},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return memberApiFailure(error); }
}
