'use client';

import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, LogOut, Palette, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'next/navigation';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { currentTheme, setTheme, themes } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowThemes(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const renderColorPreview = (theme: typeof currentTheme) => (
    <div className="flex gap-0.5 shrink-0">
      <div className="w-3 h-3 rounded-l-sm" style={{ backgroundColor: theme.colors.accentPrimary }} />
      <div className="w-3 h-3" style={{ backgroundColor: theme.colors.sidebarBg }} />
      <div className="w-3 h-3 rounded-r-sm border" style={{ backgroundColor: theme.colors.bgSecondary, borderColor: theme.colors.borderPrimary }} />
    </div>
  );

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); setShowThemes(false); }}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-white transition-all hover:bg-white/20"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline max-w-[120px] truncate">
          {user?.email?.split('@')[0]}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl border py-2 z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-secondary)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {user?.email?.split('@')[0] || 'Użytkownik'}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user?.email}
            </div>
          </div>

          <button
            onClick={() => setShowThemes(!showThemes)}
            className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors hover:opacity-80"
            style={{ backgroundColor: showThemes ? 'var(--bg-accent)' : 'transparent' }}
          >
            <Palette className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <span className="flex-1 text-left text-sm" style={{ color: 'var(--text-primary)' }}>Motyw</span>
            {renderColorPreview(currentTheme)}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showThemes ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {showThemes && (
            <div className="border-t border-b my-1 py-1" style={{ borderColor: 'var(--border-primary)' }}>
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className="w-full px-4 py-2 flex items-center gap-3 transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: currentTheme.id === theme.id ? 'var(--accent-light)' : 'transparent',
                  }}
                >
                  {renderColorPreview(theme)}
                  <span className="flex-1 text-left text-sm" style={{ color: 'var(--text-primary)' }}>
                    {theme.name}
                  </span>
                  {currentTheme.id === theme.id && (
                    <Check className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors hover:opacity-80"
            style={{ color: 'var(--error)' }}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Wyloguj</span>
          </button>
        </div>
      )}
    </div>
  );
}
