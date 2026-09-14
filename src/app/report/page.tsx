'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ReportReason } from '@/types';

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'phishing', label: 'Phishing / Fraud', desc: 'Pretending to be a legitimate service to steal credentials or payments.' },
  { value: 'malware', label: 'Malware / Virus', desc: 'Directs users to download viruses, ransomware, or malicious software.' },
  { value: 'spam', label: 'Spam / Commercial Deception', desc: 'Unsolicited bulk marketing, deceptive schemes, or affiliate spam.' },
  { value: 'illegal', label: 'Illegal Material', desc: 'Content violating applicable laws or promoting illegal goods/activities.' },
  { value: 'harassment', label: 'Harassment / Doxxing', desc: 'Targeting individuals with harassment, threats, or personal information.' },
  { value: 'other', label: 'Other Abuse', desc: 'Other serious violations of our Terms of Service.' },
];

export default function ReportPage() {
  const [linkCode, setLinkCode] = useState('');
  const [reason, setReason] = useState<ReportReason>('phishing');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) {
      setError('Please provide the short code or URL of the link.');
      return;
    }

    // Extract code if user pasted a full URL
    let cleanCode = linkCode.trim();
    try {
      if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
        const parsed = new URL(cleanCode);
        cleanCode = parsed.pathname.slice(1);
      } else if (cleanCode.startsWith('/')) {
        cleanCode = cleanCode.slice(1);
      }
    } catch {
      // keep cleanCode as is
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkCode: cleanCode,
          reason,
          details: details.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit report. Please try again.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '680px' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2.25rem', marginBottom: 'var(--space-2)' }}>Report Malicious Link</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          We take abuse seriously. Reports are reviewed by our safety team and offending links are promptly disabled.
        </p>
      </div>

      {submitted ? (
        <div
          className="card card-glass"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            border: '1px solid var(--color-success)',
          }}
        >
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--space-3)' }}>🛡️</span>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)', color: 'var(--color-success)' }}>
            Report Submitted
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            Thank you for helping keep Shorty safe. Our moderation team has queued this link for review.
          </p>
          <Link href="/" className="btn btn-primary">
            Return to Homepage
          </Link>
        </div>
      ) : (
        <div className="card card-glass" style={{ padding: 'var(--space-8)' }}>
          {error && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                border: '1px solid hsl(0, 84%, 65%, 0.3)',
                fontSize: '0.875rem',
                marginBottom: 'var(--space-6)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <Input
                label="Short link code or full URL *"
                placeholder="e.g. jk7ien or https://shorty.sji.one/jk7ien"
                value={linkCode}
                onChange={(e) => setLinkCode(e.target.value)}
                required
              />

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Reason for reporting *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: reason === r.value ? 'var(--surface-3)' : 'var(--surface-2)',
                        border: '1px solid',
                        borderColor: reason === r.value ? 'var(--brand-primary)' : 'var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          {r.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="report-details"
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Additional details (optional)
                </label>
                <textarea
                  id="report-details"
                  rows={4}
                  className="input"
                  placeholder="Provide context or evidence of harmful content..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <Button
                type="submit"
                variant="danger"
                size="lg"
                isLoading={loading}
                style={{ width: '100%', marginTop: 'var(--space-2)' }}
              >
                Submit Abuse Report
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
