import { NextRequest, NextResponse } from 'next/server';
import { setupDemoEnvironment } from '@/lib/mock/setup-demo';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

interface SetupDemoBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED) {
    return NextResponse.json(
      { error: 'Setup demo niedostępny w produkcji' },
      { status: 403 }
    );
  }

  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { error: 'Brak uprawnień — wymagana rola admin' },
      { status: 403 }
    );
  }

  let body: SetupDemoBody = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is allowed, values can come from env vars
  }

  const demoEmail = (body.email || process.env.DEMO_USER_EMAIL || 'demo@demo.pl')
    .trim()
    .toLowerCase();
  const demoPassword = (body.password || process.env.DEMO_USER_PASSWORD || '').trim();

  if (!demoPassword) {
    return NextResponse.json(
      {
        error:
          'Brak hasła demo. Ustaw DEMO_USER_PASSWORD w zmiennych środowiskowych albo przekaż "password" w body.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await setupDemoEnvironment(getAdminClient(), {
      email: demoEmail,
      password: demoPassword,
    });

    return NextResponse.json({
      success: true,
      message: `Wersja demo gotowa: konto ${result.demoEmail}, ${result.mailboxesSeeded} skrzynki, ${result.emailsSeeded} emaili, ${result.threadsBuilt} wątków`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
