import { NextRequest, NextResponse } from 'next/server';
import { getMembers, createMember } from '@/lib/database';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Members list is also used by the entry page (Cell Leader mode) — no auth required for GET
    const { searchParams } = new URL(request.url);
    const designation = searchParams.get('designation') || undefined;
    const fellowship = searchParams.get('fellowship') || undefined;

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
    const authenticated = await isAuthenticated();
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
