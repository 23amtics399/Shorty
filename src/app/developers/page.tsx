export const metadata = {
  title: 'API Documentation',
  description: 'Shorty REST API documentation for developers.',
  alternates: { canonical: '/developers' },
};

export default function DevelopersPage() {
  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '840px' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>
          Developer <span className="gradient-text">API</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
          Integrate lightning-fast link shortening into your applications, scripts, and workflows.
        </p>
      </div>

      {/* Endpoint: Create Link */}
      <div className="card card-glass" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'var(--space-4)' }}>
          <span className="badge badge-success" style={{ fontSize: '0.875rem' }}>POST</span>
          <code style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>/api/v1/links</code>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Create a new short link. Supports anonymous creation (capped at 24 hours) and authenticated creation (custom aliases and extended lifetimes).
        </p>

        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
          Request Body (JSON)
        </h3>
        <pre
          style={{
            background: 'var(--surface-2)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto',
            marginBottom: 'var(--space-4)',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
          }}
        >
{`{
  "url": "https://yourdomain.com/landing-page",
  "customAlias": "my-promo",       // Optional (requires auth)
  "expiresAt": "2026-10-01T00:00:00Z" // Optional ISO string
}`}
        </pre>

        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
          Response (201 Created)
        </h3>
        <pre
          style={{
            background: 'var(--surface-2)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto',
            fontSize: '0.875rem',
            color: 'var(--brand-secondary)',
          }}
        >
{`{
  "code": "my-promo",
  "shortUrl": "https://shorty.sji.one/my-promo",
  "originalUrl": "https://yourdomain.com/landing-page",
  "expiresAt": "2026-10-01T00:00:00.000Z"
}`}
        </pre>
      </div>

      {/* cURL Example */}
      <div className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>Example Usage</h3>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            cURL Request
          </span>
          <pre
            style={{
              background: 'var(--surface-2)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              overflowX: 'auto',
              fontSize: '0.875rem',
              color: 'var(--brand-secondary)',
            }}
          >
{`curl -X POST https://shorty.sji.one/api/v1/links \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://github.com/trending"}'`}
          </pre>
        </div>

        <div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            JavaScript / TypeScript (fetch)
          </span>
          <pre
            style={{
              background: 'var(--surface-2)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              overflowX: 'auto',
              fontSize: '0.875rem',
              color: 'var(--brand-secondary)',
            }}
          >
{`const response = await fetch('https://shorty.sji.one/api/v1/links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' }),
});

const data = await response.json();
console.log('Short URL:', data.shortUrl);`}
          </pre>
        </div>
      </div>

      {/* Rate Limits */}
      <div className="card" style={{ padding: 'var(--space-8)' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Rate Limits</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          To maintain high availability and prevent abuse, standard rate limits are enforced via distributed Redis counters:
        </p>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li><strong>Anonymous users:</strong> 5 link creations per hour per IP address.</li>
          <li><strong>Authenticated accounts:</strong> 50 link creations per hour per user account.</li>
          <li><strong>General API requests:</strong> 30 requests per minute.</li>
        </ul>
      </div>
    </div>
  );
}
