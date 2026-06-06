import { Mail, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional message shown above the buttons, e.g. "Sign in to keep your purchase". */
  reason?: string;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function SignInModal({ open, onClose, reason }: SignInModalProps) {
  const { requestEmailLink, googleSignInUrl, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setStatus('idle');
      setError(null);
      return;
    }
    const timer = window.setTimeout(() => emailInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus('sending');
    setError(null);
    clearAuthError();
    try {
      await requestEmailLink(trimmed);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send link. Try again.');
    }
  }

  function onGoogle() {
    clearAuthError();
    window.location.href = googleSignInUrl();
  }

  const bannerError = error ?? authError;

  return (
    <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="signin-title" onClick={onClose}>
      <div className="signin-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="signin-close" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="signin-title" className="signin-title">Sign in to Spec Builder</h2>
        <p className="signin-sub">
          {reason ?? 'Keep your purchase and quota in sync across every device you use.'}
        </p>

        {bannerError && (
          <p className="signin-error" role="alert">
            {bannerError}
            <button
              type="button"
              className="signin-error-dismiss"
              onClick={() => { setError(null); clearAuthError(); }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </p>
        )}

        <button type="button" className="signin-google" onClick={onGoogle}>
          <GoogleGlyph />
          Continue with Google
        </button>

        <div className="signin-divider"><span>or</span></div>

        {status === 'sent' ? (
          <div className="signin-sent" role="status">
            <Mail size={18} aria-hidden="true" />
            <div>
              <strong>Check your inbox.</strong>
              <p>We sent a sign-in link to {email}. Open it on this device to finish.</p>
            </div>
          </div>
        ) : (
          <form className="signin-email-form" onSubmit={onEmailSubmit}>
            <label className="signin-label" htmlFor="signin-email">Email me a sign-in link</label>
            <div className="signin-email-row">
              <input
                id="signin-email"
                ref={emailInputRef}
                type="email"
                className="signin-email-input"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={status === 'sending'}
                required
                autoComplete="email"
              />
              <button
                type="submit"
                className="signin-email-submit"
                disabled={status === 'sending' || !email.trim()}
              >
                {status === 'sending' ? 'Sending…' : 'Send link'}
              </button>
            </div>
          </form>
        )}

        <p className="signin-foot">
          No passwords. The link is good for 15 minutes.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
