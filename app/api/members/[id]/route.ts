import { NextRequest, NextResponse } from 'next/server';
import { updateMember, deleteMember } from '@/lib/database';
import { isAuthenticated } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, phone, fellowship, designation, birthday, location } = body;

    if (!name || !fellowship || !designation) {
      return NextResponse.json(
        { error: 'Name, fellowship, and designation are required' },
        { status: 400 }
      );
    }

    const member = await updateMember(id, {
      name: name.trim(),
      phone: (phone || '').trim(),
      fellowship: fellowship.trim(),
      designation: designation.trim(),
      birthday: (birthday || '').trim(),
      location: (location || '').trim(),
    });

    return NextResponse.json(member);
  } catch (error: any) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    await deleteMember(id);

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
