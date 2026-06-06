import { LogIn, LogOut, Moon, Sun, RefreshCcw, Mail, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import * as api from '../lib/api';

type View = 'home' | 'contact';

interface SiteNavProps {
  view: View;
  setView: (view: View) => void;
  theme: 'dark' | 'light';
  setTheme: (next: 'dark' | 'light') => void;
  onOpenSignIn: () => void;
  onReset: () => void;
  premiumLabel: string | null;
}

const NAV_LINKS: Array<{ id: string; label: string }> = [
  { id: 'features', label: 'Features' },
  { id: 'cli', label: 'CLI' },
  { id: 'pricing', label: 'Pricing' },
];

export function SiteNav({ view, setView, theme, setTheme, onOpenSignIn, onReset, premiumLabel }: SiteNavProps) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [view]);

  function handleSectionClick(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    if (view !== 'home') {
      event.preventDefault();
      setView('home');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }

  function handleContactClick() {
    setView('contact');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  function handleBrandClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (view !== 'home') {
      event.preventDefault();
      setView('home');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }

  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-nav-inner">
        <a className="site-nav-brand" href="#top" onClick={handleBrandClick} aria-label="Spec Builder home">
          <span className="site-nav-brand-mark" aria-hidden="true">SB</span>
          <span className="site-nav-brand-text">Spec Builder</span>
        </a>

        <ul className="site-nav-links" role="menubar">
          {NAV_LINKS.map((link) => (
            <li key={link.id} role="none">
              <a
                role="menuitem"
                className="site-nav-link"
                href={`#${link.id}`}
                onClick={(event) => handleSectionClick(event, link.id)}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={view === 'contact' ? 'site-nav-link active' : 'site-nav-link'}
              onClick={handleContactClick}
              aria-current={view === 'contact' ? 'page' : undefined}
            >
              <Mail size={15} aria-hidden="true" />
              Contact
            </button>
          </li>
        </ul>

        <div className="site-nav-actions">
          {premiumLabel && <span className="site-nav-premium-badge">{premiumLabel}</span>}
          {user ? (
            <>
              {user.email && (
                <span className="site-nav-email" title={user.email}>
                  {user.email}
                </span>
              )}
              <button
                type="button"
                className="site-nav-icon-button"
                onClick={() => void signOut()}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </>
          ) : api.isConfigured() ? (
            <button
              type="button"
              className="site-nav-icon-button"
              onClick={onOpenSignIn}
              aria-label="Sign in"
              title="Sign in"
            >
              <LogIn size={18} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="site-nav-icon-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="site-nav-icon-button"
            onClick={onReset}
            aria-label="Reset form"
            title="Reset form"
          >
            <RefreshCcw size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="site-nav-icon-button site-nav-menu-toggle"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="site-nav-mobile" role="menu">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              role="menuitem"
              className="site-nav-mobile-link"
              href={`#${link.id}`}
              onClick={(event) => handleSectionClick(event, link.id)}
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            className={view === 'contact' ? 'site-nav-mobile-link active' : 'site-nav-mobile-link'}
            onClick={handleContactClick}
          >
            <Mail size={15} aria-hidden="true" />
            Contact
          </button>
        </div>
      )}
    </nav>
  );
}
