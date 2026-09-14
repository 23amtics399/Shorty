import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-inner">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            &copy; {year} Shorty. Fast, reliable URL shortening.
          </p>

          <ul className="footer-links" role="list" aria-label="Footer navigation">
            <li><Link href="/about" className="footer-link">About</Link></li>
            <li><Link href="/privacy" className="footer-link">Privacy</Link></li>
            <li><Link href="/terms" className="footer-link">Terms</Link></li>
            <li><Link href="/developers" className="footer-link">API</Link></li>
            <li><Link href="/report" className="footer-link">Report Abuse</Link></li>
            <li><Link href="/help" className="footer-link">Help</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
