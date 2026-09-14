import Link from 'next/link';

export const metadata = {
  title: 'Link Disabled',
  description: 'This short link is currently disabled and cannot be accessed.',
};

export default function DisabledPage() {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - var(--nav-height) - 100px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
      }}
    >
      <div
        className="card card-glass"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: 'var(--space-8)',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: 'var(--space-4)' }}>
          🚫
        </span>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>
          Link Disabled
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
          This short link has been disabled by its owner or temporarily suspended for review.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link href="/" className="btn btn-primary">
            Go to Homepage
          </Link>
          <Link href="/report" className="btn btn-secondary">
            Report Abuse
          </Link>
        </div>
      </div>
    </div>
  );
}
