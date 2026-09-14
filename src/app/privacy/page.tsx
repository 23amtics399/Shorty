export const metadata = {
  title: 'Privacy Policy',
  description: 'Shorty Privacy Policy and Data Handling Practices.',
};

export default function PrivacyPage() {
  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '780px' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)' }}>
        Last updated: September 14, 2026
      </p>

      <div className="card card-glass" style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            1. Information We Collect
          </h2>
          <p>
            When you create an account, we collect your email address, optional name, and a salted bcrypt cryptographic hash of your password. We never store plain-text passwords.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            When visitors use a shortened link, we record aggregate click counters and timestamp of the last access. We do NOT store visitor IP addresses, geolocation profiles, or device fingerprinting data in our persistent databases.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            2. Rate Limiting and Security
          </h2>
          <p>
            To protect our infrastructure against denial-of-service attacks, automated spam, and bot abuse, we utilize temporary, fixed-window counters in Redis based on client IP addresses. These counters expire automatically and are not linked to individual user profiles.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            3. Third-Party Sharing
          </h2>
          <p>
            We do not sell, rent, monetize, or disclose your personal information or browsing habits to advertisers or data brokers. All data is solely used to operate the URL shortening service.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            4. Data Retention
          </h2>
          <p>
            Short links created without an account expire automatically and are cleared after 24 hours. Registered users can delete their links at any time from their personal dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
