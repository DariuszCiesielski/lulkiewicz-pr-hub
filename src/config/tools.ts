import type { ToolId } from '@/types';

export interface ToolConfig {
  id: ToolId;
  name: string;
  description: string;
  icon: string;
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
    href: '/email-analyzer',
    active: true,
    comingSoon: false,
  },
  {
    id: 'fb-analyzer',
    name: 'Analizator Grup FB',
    description: 'Analiza postów i komentarzy z grup Facebook',
    icon: 'MessageSquare',
    href: '/fb-analyzer',
    active: true,
    comingSoon: false,
  },
  {
    id: 'social-media',
    name: 'Social Media Manager',
    description: 'Planowanie i zarządzanie publikacjami w mediach społecznościowych',
    icon: 'Share2',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'article-generator',
    name: 'Generator Artykułów',
    description: 'Tworzenie artykułów eksperckich i treści PR z wykorzystaniem AI',
    icon: 'FileText',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'cold-mailing',
    name: 'Cold Mailing',
    description: 'Automatyzacja kampanii cold mailingowych i follow-upów',
    icon: 'Send',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'campaign-analyzer',
    name: 'Analizator Kampanii',
    description: 'Analiza efektywności kampanii reklamowych i PR',
    icon: 'BarChart3',
    href: '#',
    active: false,
    comingSoon: true,
  },
];
