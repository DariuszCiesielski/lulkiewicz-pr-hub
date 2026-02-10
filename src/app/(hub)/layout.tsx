import { AuthProvider } from '@/contexts/AuthContext';

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-900">
        <main className="p-6">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
