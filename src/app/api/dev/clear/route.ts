import { NextResponse } from 'next/server';
import { clearMockData } from '@/lib/mock/seed-data';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export async function POST() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED) {
    return NextResponse.json(
      { error: 'Clear niedostępny w produkcji' },
      { status: 403 }
    );
  }

  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { error: 'Brak uprawnień — wymagana rola admin' },
      { status: 403 }
    );
  }

  try {
    await clearMockData(getAdminClient());
    return NextResponse.json({
      success: true,
      message: 'Mock data usunięte pomyślnie',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
