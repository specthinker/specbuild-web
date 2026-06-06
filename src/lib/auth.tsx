/**
 * Auth context for the SpecBuild frontend.
 *
 * Single source of truth for "who is the current user, and what's their plan".
 *
 * On mount:
 *   - Reads the ?signed_in / ?signed_in=0&error=... params the backend
 *     tacks on after an email or Google callback redirect.
 *   - Strips them from the URL.
 *   - Refreshes /auth/me so a successful sign-in becomes visible.
 *   - Exposes any sign-in failure in `authError` for the UI to render.
 *
 * Anonymous users get `user === null`. The polish flow still works via
 * clientId for them; we just don't show "you're signed in".
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api';

interface AuthState {
  user: api.AuthUser | null;
  loading: boolean;
  /** Last sign-in failure (e.g. invalid magic link). Cleared on next attempt. */
  authError: string | null;
  /** Dismiss the current authError. */
  clearAuthError: () => void;
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

const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'That sign-in link is no longer valid. Try signing in again.',
  token_expired: 'That sign-in link has expired. Try signing in again.',
  email_send_failed: 'We couldn\u2019t email you a link. Try again in a moment.',
};

/**
 * Pulls the auth-related query params the backend tacks on after a callback
 * redirect, removes them from the URL, and reports what happened.
 */
function consumeAuthQueryParams(): { signedIn: boolean; errorCode: string | null } {
  if (typeof window === 'undefined') return { signedIn: false, errorCode: null };
  const url = new URL(window.location.href);
  const signedInRaw = url.searchParams.get('signed_in');
  const errorCode = url.searchParams.get('error');
  const signedIn = signedInRaw === '1';
  url.searchParams.delete('signed_in');
  url.searchParams.delete('error');
  window.history.replaceState(null, '', url.toString());
  return { signedIn, errorCode };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<api.AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(api.isConfigured());
  const [authError, setAuthError] = useState<string | null>(null);

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
    setAuthError(null);
    const clientId = api.getOrCreateClientId();
    try {
      await api.requestEmailLink(email, clientId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send link. Try again.';
      setAuthError(message);
      throw err;
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  useEffect(() => {
    const { signedIn, errorCode } = consumeAuthQueryParams();
    if (errorCode) {
      setAuthError(SIGN_IN_ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Try again.');
    }
    void refresh().then(() => {
      // If the callback succeeded, the user is now non-null. No extra work.
      // We don't need to act on signedIn itself; refresh() is the truth.
      if (signedIn) setAuthError(null);
    });
  }, [refresh]);

  const value: AuthState = {
    user,
    loading,
    authError,
    clearAuthError,
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
