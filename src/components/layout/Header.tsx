import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/config';
import { ADMIN_EMAIL } from '@/lib/config';
import styles from './Header.module.css';

export async function Header() {
  const session = await auth();
  const adminEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAIL || '').trim().toLowerCase();
  const userEmail = session?.user?.email?.trim().toLowerCase();
  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = Boolean(
    userEmail && ((adminEmail && userEmail === adminEmail) || userRole === 'admin')
  );

  return (
    <header className="nav" role="banner">
      <div className="container">
        <nav className="nav-inner" aria-label="Main navigation">
          <Link href="/" className="nav-logo" aria-label="Shorty home">
            <svg
              width="24"
              height="24"
              viewBox="0 0 512 512"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
              style={{ flexShrink: 0 }}
            >
              <defs>
                <linearGradient id="nav-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="35%" stopColor="#8b5cf6" />
                  <stop offset="70%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
                <linearGradient id="nav-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#181a26" />
                  <stop offset="100%" stopColor="#0a0c12" />
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="116" fill="url(#nav-bg-grad)" stroke="#262b3d" strokeWidth="16" />
              <path
                d="M 200 312 L 312 200 A 64 64 0 0 1 376 264 A 64 64 0 0 1 312 328 L 260 328"
                fill="none"
                stroke="url(#nav-brand-grad)"
                strokeWidth="54"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 312 200 L 200 312 A 64 64 0 0 1 136 248 A 64 64 0 0 1 200 184 L 252 184"
                fill="none"
                stroke="url(#nav-brand-grad)"
                strokeWidth="54"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="220"
                y1="292"
                x2="292"
                y2="220"
                stroke="#ffffff"
                strokeWidth="14"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
            <span>Shorty</span>
          </Link>

          <ul className="nav-links" role="list">
            <li>
              <Link href="/features" className="nav-link hide-mobile">
                Features
              </Link>
            </li>
            <li>
              <Link href="/developers" className="nav-link hide-mobile">
                API
              </Link>
            </li>
            <li>
              <Link href="/about" className="nav-link hide-mobile">
                About
              </Link>
            </li>
            {session && (
              <li>
                <Link href="/dashboard" className="nav-link">
                  Dashboard
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link href="/admin" className="nav-link" style={{ color: 'var(--brand-secondary)' }}>
                  Admin
                </Link>
              </li>
            )}
          </ul>

          <div className={styles.navActions}>
            {session ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  className="hide-mobile"
                >
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/' });
                  }}
                >
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Sign Out
                  </button>
                </form>
              </div>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary btn-sm">
                  Sign In
                </Link>
                <Link href="/signup" className="btn btn-primary btn-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
