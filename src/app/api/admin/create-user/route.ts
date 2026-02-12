import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const { data } = await getAdminClient()
    .from('app_allowed_users')
    .select('role')
    .eq('email', user.email)
    .single();

  return data?.role === 'admin';
}

export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const body = await request.json();
  const { email, displayName, role, allowedTools, method, password } = body;

  // Build redirect URL for invite emails
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || '';
  const inviteRedirectTo = `${siteUrl}/auth/set-password`;

  // Check if user already exists in app_allowed_users
  const { data: existing } = await adminClient
    .from('app_allowed_users')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Użytkownik o tym emailu już istnieje' }, { status: 409 });
  }

  let userId: string | null = null;

  // Check if auth user already exists (e.g. previously deleted from app_allowed_users but not from auth)
  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const existingAuth = authUsers?.users?.find((u) => u.email === email);

  if (existingAuth) {
    userId = existingAuth.id;
    // Re-invite if method is invite, or update password if method is password
    if (method === 'invite') {
      await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: inviteRedirectTo });
    } else if (method === 'password' && password) {
      await adminClient.auth.admin.updateUserById(existingAuth.id, {
        password,
        email_confirm: true,
      });
    }
  } else if (method === 'password' && password) {
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    userId = newUser.user.id;
  } else if (method === 'invite') {
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: inviteRedirectTo });

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }
    userId = invited.user.id;
  }

  // Insert into app_allowed_users
  const { data, error } = await adminClient
    .from('app_allowed_users')
    .insert({
      email,
      user_id: userId,
      role: role || 'user',
      allowed_tools: allowedTools || [],
      display_name: displayName || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
