export const metadata = {
  title: 'Terms of Service',
  description: 'Shorty Terms of Service and Acceptable Use Policy.',
};

export default function TermsPage() {
  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '780px' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)' }}>
        Last updated: September 14, 2026
      </p>

      <div className="card card-glass" style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            1. Acceptance of Terms
          </h2>
          <p>
            By using Shorty (shorty.sji.one) or creating short links through our web interface or API, you agree to be bound by these Terms of Service.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            2. Acceptable Use Policy
          </h2>
          <p>
            You agree NOT to use Shorty to shorten, distribute, or promote links that:
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li>Direct visitors to phishing sites, credential harvesters, or financial scams.</li>
            <li>Download malware, ransomware, spyware, or malicious payloads.</li>
            <li>Infringe intellectual property or distribute pirated material.</li>
            <li>Promote illegal substances, violence, hate speech, or harassment.</li>
            <li>Bypass security protections or link to loopback/private network addresses.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            3. Termination & Link Removal
          </h2>
          <p>
            We reserve the right to immediately disable or delete any short link or suspend user accounts that violate our acceptable use policy or received validated abuse reports, without prior notice.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            4. Disclaimer of Warranty
          </h2>
          <p>
            Shorty is provided &quot;as is&quot; without warranties of any kind. While we strive for 99.9% uptime, we are not liable for any damages or downtime resulting from the use or inability to use the service.
          </p>
        </div>
      </div>
    </div>
  );
}
