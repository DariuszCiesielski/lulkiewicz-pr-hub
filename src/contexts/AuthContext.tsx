'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole, ToolId } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: UserRole | null;
  allowedTools: ToolId[];
  isLoading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  signOut: () => Promise<void>;
  canAccessTool: (toolId: ToolId) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [allowedTools, setAllowedTools] = useState<ToolId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
    setAllowedTools([]);
  };

  const canAccessTool = (toolId: ToolId): boolean => {
    if (userRole === 'admin') return true;
    return allowedTools.includes(toolId);
  };

  const isAdmin = userRole === 'admin';
  const hasAccess = userRole !== null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userRole,
        allowedTools,
        isLoading,
        isAdmin,
        hasAccess,
        signOut,
        canAccessTool,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
