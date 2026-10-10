import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-inner">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            &copy; {year} Shorty. Part of the{' '}
            <a
              href="https://sji.one"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              style={{ color: 'var(--text-secondary)' }}
            >
              SJI Network
            </a>
            .
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

        <div
          style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.8125rem',
            color: 'var(--text-tertiary)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
          aria-label="SJI Network links"
        >
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginRight: 'var(--space-1)' }}>
            SJI Network:
          </span>
          <a href="https://sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">sji.one</a>
          <span aria-hidden="true">&middot;</span>
          <a href="https://prebase.sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">prebase.sji.one</a>
          <span aria-hidden="true">&middot;</span>
          <a href="https://tempbox.sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">tempbox.sji.one</a>
          <span aria-hidden="true">&middot;</span>
          <a href="https://tools.sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">tools.sji.one</a>
          <span aria-hidden="true">&middot;</span>
          <a href="https://time.sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">time.sji.one</a>
          <span aria-hidden="true">&middot;</span>
          <a href="https://calc.sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">calc.sji.one</a>
          <span aria-hidden="true">&middot;</span>
          <a href="https://scratchpad.sji.one" target="_blank" rel="noopener noreferrer" className="footer-link">scratchpad.sji.one</a>
        </div>
      </div>
    </footer>
  );
}
