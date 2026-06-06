/**
 * Auth context for the SpecBuild frontend.
 *
 * Single source of truth for "who is the current user, and what's their plan".
 *
 * On mount:
 *   - Strips ?signed_in / ?signed_out from the URL (added by backend redirect)
 *   - Calls GET /auth/me to load the current user, if a session cookie exists
 *
 * Anonymous users get `user === null`. The polish flow still works via
 * clientId for them; we just don't show "you're signed in".
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api';

interface AuthState {
  user: api.AuthUser | null;
  loading: boolean;
  /** Reload the user from /auth/me. Use after sign-in / sign-out / polish. */
  refresh: () => Promise<void>;
  /** Sign out and clear local state. */
  signOut: () => Promise<void>;
  /** Send a magic link to the email. */
  requestEmailLink: (email: string) => Promise<void>;
  /** URL to navigate to for Google OAuth. */
  googleSignInUrl: () => string;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Removes the auth-related query params the backend tacks on after a
 * successful sign-in or sign-out redirect, without losing other params.
 */
function stripAuthQueryParams(): { signedIn: boolean; signedOut: boolean } {
  if (typeof window === 'undefined') return { signedIn: false, signedOut: false };
  const url = new URL(window.location.href);
  const signedIn = url.searchParams.has('signed_in');
  const signedOut = url.searchParams.has('signed_out');
  if (signedIn || signedOut) {
    url.searchParams.delete('signed_in');
    url.searchParams.delete('signed_out');
    window.history.replaceState(null, '', url.toString());
  }
  return { signedIn, signedOut };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<api.AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(api.isConfigured());

  const refresh = useCallback(async () => {
    if (!api.isConfigured()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // logout is best-effort; even if the call fails, clear local state
    }
    setUser(null);
  }, []);

  const requestEmailLink = useCallback(async (email: string) => {
    await api.requestEmailLink(email);
  }, []);

  useEffect(() => {
    stripAuthQueryParams();
    void refresh();
  }, [refresh]);

  const value: AuthState = {
    user,
    loading,
    refresh,
    signOut,
    requestEmailLink,
    googleSignInUrl: api.googleSignInUrl,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
