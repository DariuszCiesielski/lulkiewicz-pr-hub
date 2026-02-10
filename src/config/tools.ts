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
    id: 'tool-2',
    name: 'Narzędzie 2',
    description: 'Wkrótce dostępne',
    icon: 'Wrench',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'tool-3',
    name: 'Narzędzie 3',
    description: 'Wkrótce dostępne',
    icon: 'BarChart3',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'tool-4',
    name: 'Narzędzie 4',
    description: 'Wkrótce dostępne',
    icon: 'FileText',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'tool-5',
    name: 'Narzędzie 5',
    description: 'Wkrótce dostępne',
    icon: 'Users',
    href: '#',
    active: false,
    comingSoon: true,
  },
  {
    id: 'tool-6',
    name: 'Narzędzie 6',
    description: 'Wkrótce dostępne',
    icon: 'Settings2',
    href: '#',
    active: false,
    comingSoon: true,
  },
];
