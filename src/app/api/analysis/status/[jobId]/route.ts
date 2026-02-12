import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/** GET /api/analysis/status/[jobId] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { jobId } = await params;

  const { data: job, error } = await getAdminClient()
    .from('analysis_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  return NextResponse.json({ job });
}
