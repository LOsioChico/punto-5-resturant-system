"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import { isPastLogoutTime, nextLogoutTime } from "@/lib/timezone";
import type { AuthRole, Waiter } from "@/lib/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AuthRole | null;
  waiter: Waiter | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    waiter: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({ user: null, session: null, role: null, waiter: null, loading: false });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setState({ user: null, session: null, role: null, waiter: null, loading: false });
      return;
    }

    const role = (session.user.app_metadata?.role as AuthRole) ?? null;

    // If waiter, fetch profile
    let waiter: Waiter | null = null;
    if (role === "waiter") {
      const { data } = await supabase
        .from("waiters")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();
      waiter = (data as Waiter) ?? null;

      // Check 6am logout
      if (isPastLogoutTime()) {
        await supabase.auth.signOut();
        setState({ user: null, session: null, role: null, waiter: null, loading: false });
        return;
      }
    }

    setState({ user: session.user, session, role, waiter, loading: false });
  }, [supabase]);

  // Initial load + auth state listener
  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial state setup when supabase is not configured
      setState({ user: null, session: null, role: null, waiter: null, loading: false });
      return;
    }

    refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ user: null, session: null, role: null, waiter: null, loading: false });
        return;
      }
      const role = (session.user.app_metadata?.role as AuthRole) ?? null;
      setState((prev) => ({ ...prev, user: session.user, session, role, loading: false }));
      // Fetch waiter profile if needed
      if (role === "waiter") {
        supabase
          .from("waiters")
          .select("*")
          .eq("auth_id", session.user.id)
          .single()
          .then(({ data }) => {
            setState((prev) => ({ ...prev, waiter: (data as Waiter) ?? null }));
          });
      } else {
        setState((prev) => ({ ...prev, waiter: null }));
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refresh]);

  // 6am auto-logout timer for waiters
  useEffect(() => {
    if (!supabase || state.role !== "waiter") return;

    const ms = nextLogoutTime().getTime() - Date.now();
    // Cap at ~24 days (max setTimeout delay)
    const timer = setTimeout(() => {
      supabase.auth.signOut().then(() => {
        setState({ user: null, session: null, role: null, waiter: null, loading: false });
      });
    }, Math.min(ms, 2_147_483_000));

    return () => clearTimeout(timer);
  }, [supabase, state.role]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setState({ user: null, session: null, role: null, waiter: null, loading: false });
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ ...state, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
