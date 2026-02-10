'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [allowedTools, setAllowedTools] = useState<ToolId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchPermissions = useCallback(async (userEmail: string) => {
    const { data } = await supabase
      .from('app_allowed_users')
      .select('role, allowed_tools')
      .eq('email', userEmail)
      .single();

    if (data) {
      setUserRole(data.role as UserRole);
      setAllowedTools((data.allowed_tools || []) as ToolId[]);
    } else {
      setUserRole(null);
      setAllowedTools([]);
    }
  }, [supabase]);

  const refreshPermissions = useCallback(async () => {
    if (user?.email) {
      await fetchPermissions(user.email);
    }
  }, [user, fetchPermissions]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        await fetchPermissions(session.user.email);
      } else {
        setUserRole(null);
        setAllowedTools([]);
      }
      setIsLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        await fetchPermissions(session.user.email);
      }
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
        refreshPermissions,
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
