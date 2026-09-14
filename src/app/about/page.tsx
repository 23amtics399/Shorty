import Link from 'next/link';

export const metadata = {
  title: 'About Shorty',
  description: 'Learn about the mission, architecture, and reliability of Shorty URL Shortener.',
};

export default function AboutPage() {
  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>
        About <span className="gradient-text">Shorty</span>
      </h1>

      <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-6)' }}>
        Shorty was built with one clear principle: URL redirection should be lightning fast, completely transparent, and relentlessly reliable. We combine edge caching with resilient cloud storage to deliver sub-5ms redirects worldwide.
      </p>

      <div className="card card-glass" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-4)' }}>Our Architecture</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
          Every link shortened with Shorty is backed by an authoritative MongoDB database and cached on high-performance Upstash Redis. When a visitor taps a short link:
        </p>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>The request hits our network proxy at the edge.</li>
          <li>Cached links redirect in single-digit milliseconds without booting heavyweight application runtimes.</li>
          <li>Any cache misses seamlessly resolve through our authoritative MongoDB layer with zero downtime.</li>
          <li>All click metrics and safety evaluations occur asynchronously so your audience never waits.</li>
        </ul>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Privacy First</h3>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            We do not store user IP addresses or build intrusive advertising profiles. We collect only aggregate click counts and timestamps.
          </p>
        </div>
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Zero Dark Patterns</h3>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            No intermediate ad walls, countdown spinners, or unexpected redirects. Visitors reach their destination immediately.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
        <Link href="/" className="btn btn-primary btn-lg">
          Try Shorty Today
        </Link>
      </div>
    </div>
  );
}
