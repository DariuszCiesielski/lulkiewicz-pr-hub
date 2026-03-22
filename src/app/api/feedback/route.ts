import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyAuthenticatedUser } from '@/lib/api/admin';
import {
  buildFeedbackEmailText,
  getMissingProposalTitles,
  normalizeClientFeedbackPayload,
} from '@/lib/feedback/catalog';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_FROM = 'Lulkiewicz PR Hub <onboarding@resend.dev>';
const NOTIFICATION_EMAIL = 'dariusz.ciesielski.71@gmail.com';

export const maxDuration = 30;

async function sendFeedbackNotification(
  userEmail: string,
  createdAt: string,
  feedback: ReturnType<typeof normalizeClientFeedbackPayload>
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured');
    return false;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [NOTIFICATION_EMAIL],
      subject: `Nowa odpowiedź w ankiecie rozwoju — ${userEmail}`,
      text: buildFeedbackEmailText(userEmail, createdAt, feedback),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('Resend feedback notification failed:', response.status, responseText);
    return false;
  }

  return true;
}

export async function GET() {
  const authenticatedUser = await verifyAuthenticatedUser();

  if (!authenticatedUser) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const { data, error } = await adminClient
    .from('client_feedback')
    .select('feedback, created_at')
    .eq('user_id', authenticatedUser.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    feedback: data?.feedback ?? null,
    createdAt: data?.created_at ?? null,
  });
}

export async function POST(request: NextRequest) {
  const authenticatedUser = await verifyAuthenticatedUser();

  if (!authenticatedUser) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { feedback?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const feedback = normalizeClientFeedbackPayload(body.feedback ?? body);
  const missingProposalTitles = getMissingProposalTitles(feedback);

  if (missingProposalTitles.length > 0) {
    return NextResponse.json(
      { error: 'Wybierz zainteresowanie dla każdej propozycji rozwoju' },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();
  const { data, error } = await adminClient
    .from('client_feedback')
    .insert({
      user_id: authenticatedUser.userId,
      feedback,
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Nie udało się zapisać opinii' },
      { status: 500 }
    );
  }

  const [notificationResult] = await Promise.allSettled([
    sendFeedbackNotification(authenticatedUser.email, data.created_at, feedback),
  ]);

  if (notificationResult.status === 'rejected') {
    console.error('Feedback notification error:', notificationResult.reason);
  }

  return NextResponse.json({
    success: true,
    id: data.id,
    createdAt: data.created_at,
    emailSent:
      notificationResult.status === 'fulfilled' ? notificationResult.value : false,
  });
}
