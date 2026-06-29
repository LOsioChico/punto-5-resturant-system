"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import { nextLogoutTime } from "@/lib/timezone";
import {
  setWaiterLoginTime,
  clearWaiterLoginTime,
  isWaiterSessionExpired,
  getWaiterLoginTime,
} from "@/lib/auth/session-expiry";
import type { AuthRole, Waiter } from "@/lib/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AuthRole | null;
  waiter: Waiter | null;
  loading: boolean;
  /** When the waiter's session will expire (6am Colombia time), or null. */
  sessionExpiresAt: Date | null;
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
    sessionExpiresAt: null,
  });

  const doSignOut = useCallback(async () => {
    if (!supabase) return;
    clearWaiterLoginTime();
    await supabase.auth.signOut();
    setState({ user: null, session: null, role: null, waiter: null, loading: false, sessionExpiresAt: null });
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({ user: null, session: null, role: null, waiter: null, loading: false, sessionExpiresAt: null });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setState({ user: null, session: null, role: null, waiter: null, loading: false, sessionExpiresAt: null });
      return;
    }

    const role = (session.user.app_metadata?.role as AuthRole) ?? null;

    // If waiter, check if the session has expired past 6am (handles page reload
    // after the tab was backgrounded overnight)
    if (role === "waiter" && isWaiterSessionExpired()) {
      await doSignOut();
      return;
    }

    // If waiter, fetch profile
    let waiter: Waiter | null = null;
    if (role === "waiter") {
      const { data } = await supabase
        .from("waiters")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();
      waiter = (data as Waiter) ?? null;
    }

    setState({
      user: session.user,
      session,
      role,
      waiter,
      loading: false,
      sessionExpiresAt: role === "waiter" ? nextLogoutTime() : null,
    });
  }, [supabase, doSignOut]);

  // Initial load + auth state listener
  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial state setup when supabase is not configured
      setState({ user: null, session: null, role: null, waiter: null, loading: false, sessionExpiresAt: null });
      return;
    }

    refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        clearWaiterLoginTime();
        setState({ user: null, session: null, role: null, waiter: null, loading: false, sessionExpiresAt: null });
        return;
      }
      const role = (session.user.app_metadata?.role as AuthRole) ?? null;
      // Record login time ONLY on actual sign-in, not on token refresh or
      // initial session restoration. This ensures the stored timestamp
      // reflects the original login, not the last token refresh.
      if (event === "SIGNED_IN" && role === "waiter") {
        setWaiterLoginTime();
      }
      // Defense in depth: check session expiry on token refresh too.
      // Supabase refreshes tokens ~hourly. If the 6am timer was killed
      // (browser throttling) and the tab stayed foreground (visibility
      // check never fired), this catches the expired session on the
      // next token refresh.
      if ((event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && role === "waiter" && isWaiterSessionExpired()) {
        doSignOut();
        return;
      }
      setState((prev) => ({
        ...prev,
        user: session.user,
        session,
        role,
        loading: false,
        sessionExpiresAt: role === "waiter" ? nextLogoutTime() : null,
      }));
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
  }, [supabase, refresh, doSignOut]);

  // 6am auto-logout timer for waiters
  useEffect(() => {
    if (!supabase || state.role !== "waiter" || !state.session) return;

    let timer: ReturnType<typeof setTimeout>;

    const armTimer = () => {
      const ms = nextLogoutTime().getTime() - Date.now();
      // Cap at ~24 days (max setTimeout delay)
      timer = setTimeout(() => {
        doSignOut();
      }, Math.min(ms, 2_147_483_000));
    };

    armTimer();

    // Browsers throttle/suspend setTimeout in backgrounded tabs, so the
    // 6am timer may never fire. When the tab becomes visible again, check
    // if the session has expired (6am boundary has passed since login) and
    // sign out immediately if so. Otherwise re-arm the timer.
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (isWaiterSessionExpired()) {
        doSignOut();
        return;
      }
      // Not past logout time — re-arm the timer in case the browser killed it
      clearTimeout(timer);
      armTimer();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [supabase, state.role, state.session, doSignOut]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    clearWaiterLoginTime();
    await supabase.auth.signOut();
    setState({ user: null, session: null, role: null, waiter: null, loading: false, sessionExpiresAt: null });
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
