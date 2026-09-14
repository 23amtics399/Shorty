import Link from 'next/link';

export const metadata = {
  title: 'Help & FAQ',
  description: 'Frequently asked questions and support for Shorty URL Shortener.',
};

export default function HelpPage() {
  const faqs = [
    {
      q: 'How long do short links remain active?',
      a: 'Links created anonymously without an account remain active for up to 24 hours. If you create a free account, your links can either be permanent (no expiration) or have custom expiration dates up to 30 days.',
    },
    {
      q: 'Can I choose my own custom alias?',
      a: 'Yes! Registered users can define custom short codes (e.g., shorty.sji.one/my-campaign) as long as the slug is available and contains only letters, numbers, hyphens, and underscores.',
    },
    {
      q: 'How do I download a QR code for my link?',
      a: 'From your Dashboard, click the "QR" button next to any of your short links. A modal will appear allowing you to download high-resolution PNG or vector SVG files.',
    },
    {
      q: 'Can I disable or delete a link after creating it?',
      a: 'Yes. In your Dashboard, you can toggle any link between Active and Disabled at any time, or delete it permanently. Once deleted or disabled, the link cache is cleared immediately.',
    },
    {
      q: 'What should I do if I encounter a malicious link?',
      a: 'Please report it immediately using our Abuse Report page. Our safety team investigates and deactivates harmful, phishing, or malware-distributing links.',
    },
  ];

  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '780px' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>
          Help & <span className="gradient-text">Frequently Asked Questions</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Have questions about Shorty? Find answers here.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
        {faqs.map((faq) => (
          <div key={faq.q} className="card card-glass" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-2)' }}>{faq.q}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Still need assistance?</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Suspect abuse or have technical questions? Submit a report or reach out to our team.
        </p>
        <Link href="/report" className="btn btn-secondary">
          Report Link Abuse
        </Link>
      </div>
    </div>
  );
}
