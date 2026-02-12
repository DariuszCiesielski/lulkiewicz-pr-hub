import type { ToolId } from '@/types';

export interface ToolConfig {
  id: ToolId;
  name: string;
  description: string;
  icon: string;
  color: string;
  href: string;
  active: boolean;
  comingSoon: boolean;
}

export const TOOLS: ToolConfig[] = [
  {
    id: 'email-analyzer',
    name: 'Analizator Email',
    description: 'Analiza jakości komunikacji email administracji osiedli',
    icon: 'Mail',
    color: '#3b82f6',
    href: '/email-analyzer',
    active: true,
    comingSoon: false,
  },
  {
    id: 'fb-analyzer',
    name: 'Analizator Grup FB',
    description: 'Analiza postów i komentarzy z grup Facebook',
    icon: 'MessageSquare',
    color: '#8b5cf6',
    href: '/fb-analyzer',
    active: true,
    comingSoon: false,
  },
  {
    id: 'social-media',
    name: 'Social Media Manager',
    description: 'Planowanie i zarządzanie publikacjami w mediach społecznościowych',
    icon: 'Share2',
    color: '#ec4899',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'article-generator',
    name: 'Generator Artykułów',
    description: 'Tworzenie artykułów eksperckich i treści PR z wykorzystaniem AI',
    icon: 'FileText',
    color: '#10b981',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'cold-mailing',
    name: 'Cold Mailing',
    description: 'Automatyzacja kampanii cold mailingowych i follow-upów',
    icon: 'Send',
    color: '#f59e0b',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'campaign-analyzer',
    name: 'Analizator Kampanii',
    description: 'Analiza efektywności kampanii reklamowych i PR',
    icon: 'BarChart3',
    color: '#06b6d4',
    href: '#',
    active: false,
    comingSoon: true,
  },
];
