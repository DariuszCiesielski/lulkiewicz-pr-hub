'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Mail, Shield, Settings, X, Inbox, MessageSquare, Brain, FileText, Cog, ClipboardList, BarChart3, Users, Share2, Send } from 'lucide-react';
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
  color?: string;
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
    color: '#3b82f6',
    badge: 'Aktywny',
    children: [
      { href: '/email-analyzer/dashboard', label: 'Dashboard', icon: BarChart3, adminOnly: true },
      { href: '/email-analyzer/mailboxes', label: 'Skrzynki', icon: Inbox, adminOnly: true },
      { href: '/email-analyzer/threads', label: 'Wątki', icon: MessageSquare, adminOnly: true },
      { href: '/email-analyzer/analyze', label: 'Analiza AI', icon: Brain, adminOnly: true },
      { href: '/email-analyzer/reports', label: 'Raporty', icon: ClipboardList, adminOnly: true },
      { href: '/email-analyzer/prompts', label: 'Prompty', icon: FileText, adminOnly: true },
      { href: '/email-analyzer/settings', label: 'Ustawienia AI', icon: Cog, adminOnly: true },
    ],
  },
  {
    href: '/fb-analyzer',
    label: 'Analizator Grup FB',
    icon: MessageSquare,
    color: '#8b5cf6',
    badge: 'Aktywny',
    children: [
      { href: '/fb-analyzer/dashboard', label: 'Dashboard', icon: BarChart3, adminOnly: true },
      { href: '/fb-analyzer/groups', label: 'Grupy', icon: Users, adminOnly: true },
      { href: '/fb-analyzer/posts', label: 'Posty', icon: MessageSquare, adminOnly: true },
      { href: '/fb-analyzer/analyze', label: 'Analiza', icon: Brain, adminOnly: true },
      { href: '/fb-analyzer/reports', label: 'Raporty', icon: ClipboardList, adminOnly: true },
      { href: '/fb-analyzer/settings', label: 'Ustawienia', icon: Cog, adminOnly: true },
    ],
  },
  { href: '#', label: 'Social Media Manager', icon: Share2, color: '#ec4899', comingSoon: true },
  { href: '#', label: 'Generator Artykułów', icon: FileText, color: '#10b981', comingSoon: true },
  { href: '#', label: 'Cold Mailing', icon: Send, color: '#f59e0b', comingSoon: true },
  { href: '#', label: 'Analizator Kampanii', icon: BarChart3, color: '#06b6d4', comingSoon: true },
  { href: '/admin', label: 'Panel admina', icon: Shield, adminOnly: true },
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
                    opacity: 0.5,
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" style={{ color: item.color }} />
                  <span className="flex-1">{item.label}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: item.color ? `${item.color}25` : 'var(--sidebar-hover)',
                      color: item.color || 'var(--sidebar-text)',
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
                <Icon className="h-5 w-5 shrink-0" style={{ color: isActive ? '#ffffff' : item.color }} />
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
