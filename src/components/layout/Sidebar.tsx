'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Mail, Shield, Settings, X, Inbox } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SubNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
  comingSoon?: boolean;
  children?: SubNavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/email-analyzer',
    label: 'Analizator Email',
    icon: Mail,
    badge: 'Aktywny',
    children: [
      { href: '/email-analyzer/mailboxes', label: 'Skrzynki', icon: Inbox, adminOnly: true },
    ],
  },
  { href: '/admin', label: 'Panel admina', icon: Shield, adminOnly: true },
  { href: '/settings', label: 'Ustawienia', icon: Settings, comingSoon: true },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const filteredItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const sidebarContent = (
    <div
      className="flex h-full w-64 flex-col"
      style={{ backgroundColor: 'var(--sidebar-bg)' }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--header-text)' }}
        >
          Lulkiewicz PR Hub
        </h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-white/10 lg:hidden"
          style={{ color: 'var(--sidebar-text)' }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          // Filter children by admin access
          const visibleChildren = item.children?.filter(
            (child) => !child.adminOnly || isAdmin
          );

          return (
            <div key={item.href}>
              {item.comingSoon ? (
                <span
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-not-allowed"
                  style={{
                    color: 'var(--sidebar-text)',
                    opacity: 0.4,
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--sidebar-hover)',
                      color: 'var(--sidebar-text)',
                    }}
                  >
                    Wkrótce
                  </span>
                </span>
              ) : (
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--sidebar-text)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--accent-light)',
                      color: isActive ? '#ffffff' : 'var(--accent-primary)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
              )}

              {/* Sub-navigation items */}
              {visibleChildren && visibleChildren.length > 0 && isActive && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {visibleChildren.map((child) => {
                    const isChildActive = pathname === child.href;
                    const ChildIcon = child.icon;

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
                        style={{
                          backgroundColor: isChildActive ? 'var(--sidebar-active)' : 'transparent',
                          color: isChildActive ? '#ffffff' : 'var(--sidebar-text)',
                          opacity: isChildActive ? 1 : 0.8,
                        }}
                        onMouseEnter={(e) => {
                          if (!isChildActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isChildActive) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <ChildIcon className="h-4 w-4 shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={onClose}
          />
          <div className="relative h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
