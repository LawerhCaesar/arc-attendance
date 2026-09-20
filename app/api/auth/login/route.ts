import { NextRequest, NextResponse } from 'next/server';
import { APP_ROLES, AppRole, createSession, homeForRole, verifyPassword } from '@/lib/auth';

interface ConfiguredUser {
  username: string;
  password: string;
  role: AppRole;
  fellowship?: string;
}

function configuredUsers(): ConfiguredUser[] {
  const users: ConfiguredUser[] = [];

  if (process.env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.APP_USERS_JSON) as Partial<ConfiguredUser>[];
      parsed.forEach(user => {
        if (user.username && user.password && user.role && APP_ROLES.includes(user.role)) {
          users.push({
            username: user.username,
            password: user.password,
            role: user.role,
            fellowship: user.fellowship,
          });
        }
      });
    } catch {
      console.error('APP_USERS_JSON is not valid JSON');
    }
  }

  const legacyUsername = process.env.ADMIN_USERNAME;
  const legacyPassword = process.env.ADMIN_PASSWORD;
  if (legacyUsername && legacyPassword && !users.some(user => user.username === legacyUsername)) {
    const configuredRole = process.env.ADMIN_ROLE as AppRole | undefined;
    users.push({
      username: legacyUsername,
      password: legacyPassword,
      role: configuredRole && APP_ROLES.includes(configuredRole) ? configuredRole : 'admin',
    });
  }

  return users;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const users = configuredUsers();
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Staff credentials not configured' },
        { status: 500 }
      );
    }

    const user = users.find(candidate => candidate.username === username);
    const isValid = user ? await verifyPassword(password, user.password) : false;

    if (!user || !isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    await createSession({
      username: user.username,
      role: user.role,
      fellowship: user.fellowship,
    });

    return NextResponse.json(
      {
        message: 'Login successful',
        role: user.role,
        redirectTo: homeForRole(user.role),
      },
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
