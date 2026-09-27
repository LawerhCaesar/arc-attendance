import { NextRequest, NextResponse } from 'next/server';
import { updateMember, deleteMember } from '@/lib/database';
import { getAuthContext } from '@/lib/auth';

async function checkEditAccess() {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: 'Your session has ended. Sign in again to save your changes.', code: 'SESSION_REQUIRED' }, { status: 401 });
  }
  if (!['admin', 'pastor'].includes(context.role)) {
    return NextResponse.json({ error: 'Only an admin or pastor can edit the member roster.', code: 'ROLE_FORBIDDEN' }, { status: 403 });
  }
  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessError = await checkEditAccess();
    if (accessError) return accessError;

    const { id } = await params;
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessError = await checkEditAccess();
    if (accessError) return accessError;

    const { id } = await params;
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
