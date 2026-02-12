import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const { data, error } = await adminClient
    .from('app_allowed_users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const body = await request.json();
  const { id, role, allowed_tools, display_name } = body;

  const { data, error } = await adminClient
    .from('app_allowed_users')
    .update({ role, allowed_tools, display_name })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Brak ID' }, { status: 400 });
  }

  // Get user_id before deleting from app_allowed_users
  const { data: userRecord } = await adminClient
    .from('app_allowed_users')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await adminClient
    .from('app_allowed_users')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also delete from auth.users to allow clean re-invite
  if (userRecord?.user_id) {
    await adminClient.auth.admin.deleteUser(userRecord.user_id);
  }

  return NextResponse.json({ success: true });
}
