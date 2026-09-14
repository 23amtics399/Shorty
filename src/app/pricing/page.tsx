import Link from 'next/link';

export const metadata = {
  title: 'Pricing',
  description: 'Simple, transparent, 100% free URL shortening for everyone.',
};

export default function PricingPage() {
  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '880px' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>
          Simple, <span className="gradient-text">100% Free</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
          No hidden fees, no credit card required, and no artificial paywalls.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-8)',
          alignItems: 'stretch',
          marginBottom: 'var(--space-12)',
        }}
      >
        {/* Free Plan */}
        <div className="card" style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Anonymous Guest</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            Quickly shorten links without signing up.
          </p>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 'var(--space-6)' }}>
            $0 <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>forever</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--space-8)', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <li>✓ Ultra-fast Redis redirects</li>
            <li>✓ Auto-generated 7-character short codes</li>
            <li>✓ Automatic expiration after 24 hours</li>
            <li>✓ 5 links per hour per IP</li>
            <li>✓ Instant QR code generation</li>
          </ul>

          <Link href="/" className="btn btn-secondary" style={{ width: '100%' }}>
            Shorten as Guest
          </Link>
        </div>

        {/* Registered Plan */}
        <div
          className="card card-glass"
          style={{
            padding: 'var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            border: '2px solid var(--brand-primary)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              right: '24px',
              background: 'var(--brand-gradient)',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Recommended
          </div>

          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Registered Member</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            Full control, custom aliases, and live dashboard tracking.
          </p>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 'var(--space-6)' }}>
            $0 <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>free account</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--space-8)', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <li>✓ Everything in Guest plan</li>
            <li>✓ <strong>Custom aliases</strong> (e.g. /my-brand)</li>
            <li>✓ <strong>Permanent links</strong> (never expire)</li>
            <li>✓ Configurable expiration up to 30 days</li>
            <li>✓ Full management dashboard</li>
            <li>✓ Real-time click statistics</li>
            <li>✓ Downloadable SVG/PNG QR codes</li>
            <li>✓ 50 links per hour creation limit</li>
          </ul>

          <Link href="/signup" className="btn btn-primary" style={{ width: '100%' }}>
            Create Free Account
          </Link>
        </div>
      </div>
    </div>
  );
}
