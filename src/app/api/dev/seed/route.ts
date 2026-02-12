import { NextResponse } from 'next/server';
import { seedMockData } from '@/lib/mock/seed-data';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export async function POST() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED) {
    return NextResponse.json(
      { error: 'Seed niedostępny w produkcji' },
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
    const result = await seedMockData(getAdminClient());
    return NextResponse.json({
      success: true,
      message: `Seed zakończony: ${result.mailboxes} skrzynek, ${result.emails} emaili, ${result.threads} wątków`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
