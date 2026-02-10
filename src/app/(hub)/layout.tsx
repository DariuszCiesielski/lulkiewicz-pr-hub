'use client';

import { useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex flex-1 flex-col">
            <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>

            <Footer />
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
