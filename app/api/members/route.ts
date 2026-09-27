import { NextRequest, NextResponse } from 'next/server';
import { getMembers, createMember } from '@/lib/database';
import { getAuthContext, hasPermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext();

    const { searchParams } = new URL(request.url);
    const designation = searchParams.get('designation') || undefined;
    const requestedFellowship = searchParams.get('fellowship') || undefined;
    const fellowship = context?.role === 'fellowship_leader'
      ? context.fellowship
      : requestedFellowship;

    if (context?.role === 'fellowship_leader' && !fellowship) {
      return NextResponse.json({ error: 'No fellowship scope configured' }, { status: 403 });
    }

    const members = await getMembers(designation, fellowship);
    return NextResponse.json(members);
  } catch (error: any) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await hasPermission('members');
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, fellowship, designation, birthday, location } = body;

    if (!name || !fellowship || !designation) {
      return NextResponse.json(
        { error: 'Name, fellowship, and designation are required' },
        { status: 400 }
      );
    }

    const member = await createMember({
      name: name.trim(),
      phone: (phone || '').trim(),
      fellowship: fellowship.trim(),
      designation: designation.trim(),
      birthday: (birthday || '').trim(),
      location: (location || '').trim(),
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}
