'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FbAnalyzerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/fb-analyzer/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p style={{ color: 'var(--text-muted)' }}>Przekierowanie...</p>
    </div>
  );
}
