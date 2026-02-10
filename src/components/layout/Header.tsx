'use client';

import { Menu } from 'lucide-react';
import UserMenu from './UserMenu';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 lg:px-6"
      style={{
        backgroundColor: 'var(--header-bg)',
        background: 'var(--header-gradient)',
        color: 'var(--header-text)',
      }}
    >
      <button
        onClick={onToggleSidebar}
        className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <UserMenu />
    </header>
  );
}
