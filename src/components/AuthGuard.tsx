import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getUserRole = async (userId: string): Promise<'admin' | 'staff' | 'client'> => {
    try {
      // Check roles using secure RPC function
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      if (isAdmin === true) return 'admin';
      
      const { data: isStaff } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'staff'
      });
      
      if (isStaff === true) return 'staff';
      
      return 'client';
    } catch (error) {
      // Silent fail - default to client role
      return 'client';
    }
  };

  // Determine redirect path for authenticated users on auth pages
  useEffect(() => {
    if (!requireAuth && user) {
      getUserRole(user.id).then((role) => {
        const isAdmin = role === 'admin' || role === 'staff';
        setRedirectPath(isAdmin ? '/admin/dashboard' : '/client/dashboard');
      });
    }
  }, [user, requireAuth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded w-96"></div>
        </div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!requireAuth && user) {
    // Redirect authenticated users away from auth pages based on their role
    if (redirectPath) {
      return <Navigate to={redirectPath} replace />;
    }
    
    // Show loading while determining redirect path
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}