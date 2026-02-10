'use client';

import { useAuth } from '@/contexts/AuthContext';
import { TOOLS } from '@/config/tools';
import ToolCard from './ToolCard';

export default function ToolsGrid() {
  const { canAccessTool } = useAuth();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          canAccess={canAccessTool(tool.id)}
        />
      ))}
    </div>
  );
}
