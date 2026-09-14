import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/config';
import { ADMIN_EMAIL } from '@/lib/config';
import styles from './Header.module.css';

export async function Header() {
  const session = await auth();
  const isAdmin =
    session?.user?.email &&
    ADMIN_EMAIL &&
    session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <header className="nav" role="banner">
      <div className="container">
        <nav className="nav-inner" aria-label="Main navigation">
          <Link href="/" className="nav-logo" aria-label="Shorty home">
            Shorty
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
