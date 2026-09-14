import Link from 'next/link';

export const metadata = {
  title: '404 - Not Found',
  description: 'The requested page or short link does not exist.',
};

export default function NotFound() {
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
        <span
          className="gradient-text"
          style={{ fontSize: '4.5rem', fontWeight: 800, display: 'block', lineHeight: 1, marginBottom: 'var(--space-3)' }}
        >
          404
        </span>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>
          Link Not Found
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
          We couldn&apos;t find the short code or page you were looking for. It may have expired, been deleted, or mistyped.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link href="/" className="btn btn-primary">
            Create Short Link
          </Link>
          <Link href="/help" className="btn btn-secondary">
            Get Help
          </Link>
        </div>
      </div>
    </div>
  );
}
