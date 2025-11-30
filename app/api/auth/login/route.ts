import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      return NextResponse.json(
        { error: 'Admin credentials not configured' },
        { status: 500 }
      );
    }

    // Check if password is already hashed (starts with $2a$ or $2b$)
    const isPasswordHashed = adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$');
    
    let isValid = false;
    if (isPasswordHashed) {
      isValid = await bcrypt.compare(password, adminPassword);
    } else {
      // Plain text comparison (for initial setup, should be changed to hashed)
      isValid = username === adminUsername && password === adminPassword;
    }

    if (username !== adminUsername || !isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    await createSession();

    return NextResponse.json(
      { message: 'Login successful' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}

