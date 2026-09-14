import Link from 'next/link';

export const metadata = {
  title: 'Features',
  description: 'Explore the high-performance link shortening, analytics, and QR code features of Shorty.',
};

export default function FeaturesPage() {
  const features = [
    {
      icon: '⚡',
      title: 'Ultra-Low Latency Redirects',
      desc: 'Our multi-tier redirect system utilizes Redis fast-path caching at the network boundary. Popular links resolve in under 5ms worldwide.',
    },
    {
      icon: '🎯',
      title: 'Custom Branded Aliases',
      desc: 'Replace random character strings with memorable, branded slugs like shorty.sji.one/launch or shorty.sji.one/summit.',
    },
    {
      icon: '⏱',
      title: 'Configurable Expiration',
      desc: 'Set links to automatically expire after hours or days. Ideal for flash sales, private event invites, and temporary campaigns.',
    },
    {
      icon: '◻',
      title: 'Print-Ready QR Codes',
      desc: 'Generate crisp, downloadable SVG and PNG QR codes client-side for every shortened link — ready for posters, merchandise, and print.',
    },
    {
      icon: '📊',
      title: 'Real-Time Click Tracking',
      desc: 'Monitor link performance with live click counts and access timestamps from an intuitive management dashboard.',
    },
    {
      icon: '🛡️',
      title: 'Phishing & Abuse Protection',
      desc: 'Automated protection filters dangerous schemes, loopback targets, and private networks. Community reporting keeps links safe.',
    },
  ];

  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
      <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto var(--space-12)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>
          Engineered for <span className="gradient-text">Speed and Control</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
          Every tool you need to create, manage, and distribute short links without the bloat.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-16)',
        }}
      >
        {features.map((f) => (
          <div key={f.title} className="card card-glass" style={{ padding: 'var(--space-8)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 'var(--space-4)' }}>
              {f.icon}
            </span>
            <h2 style={{ fontSize: '1.375rem', marginBottom: 'var(--space-2)' }}>
              {f.title}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: '800px',
          margin: '0 auto',
          background: 'linear-gradient(135deg, hsl(258, 84%, 68%, 0.1) 0%, hsl(196, 95%, 62%, 0.1) 100%)',
          border: '1px solid var(--border-default)',
        }}
      >
        <h2 style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>
          Ready to experience the difference?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', maxWidth: '500px', margin: '0 auto var(--space-6)' }}>
          Create an account to unlock custom aliases, permanent URLs, and dashboard analytics.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Get Started Free
          </Link>
          <Link href="/" className="btn btn-secondary btn-lg">
            Shorten a Link
          </Link>
        </div>
      </div>
    </div>
  );
}
