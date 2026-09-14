import Link from 'next/link';

export const metadata = {
  title: 'Link Expired',
  description: 'This short link has expired and is no longer available.',
};

export default function ExpiredPage() {
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
          ⏱️
        </span>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>
          Link Expired
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
          The link you tried to access has passed its expiration date and is no longer active.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link href="/" className="btn btn-primary">
            Create a New Short Link
          </Link>
          <Link href="/help" className="btn btn-secondary">
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
