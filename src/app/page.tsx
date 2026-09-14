'use client';

import { useState, useId } from 'react';
import styles from './page.module.css';

// NOTE: metadata is in layout.tsx.
// The homepage is client-side for form interactivity.

interface ShortenResult {
  shortUrl: string;
  code: string;
}

export default function HomePage() {
  const urlId = useId();
  const aliasId = useId();
  const expiryId = useId();

  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShortenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, string | null | undefined> = { url: url.trim() };
      if (alias.trim()) body.customAlias = alias.trim();
      if (expiresAt) body.expiresAt = expiresAt;

      const res = await fetch('/api/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult({ shortUrl: data.shortUrl, code: data.code });
      setUrl('');
      setAlias('');
      setExpiresAt('');
      setShowAdvanced(false);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }

  // Min date for expiry: tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return (
    <section className={styles.hero}>
          {/* Eyebrow */}
          <span className={styles.heroEyebrow} aria-label="Feature highlight">
            ⚡ Lightning-Fast Redirects
          </span>

          {/* Hero heading */}
          <h1 className={styles.heroTitle}>
            Shorten Links.{' '}
            <span className="gradient-text">Track Everything.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Create short, memorable links in seconds. Share them anywhere, track clicks,
            set expiration dates, and generate QR codes — all for free.
          </p>

          {/* Main shorten form */}
          <div className={styles.formCard} role="region" aria-label="URL shortener">
            <form onSubmit={handleSubmit} noValidate>
              {/* URL input row */}
              <div className={styles.urlRow}>
                <label htmlFor={urlId} className="visually-hidden">
                  Enter your long URL
                </label>
                <input
                  id={urlId}
                  type="url"
                  className={styles.urlInput}
                  placeholder="Paste your long URL here…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoComplete="url"
                  spellCheck={false}
                  required
                  disabled={loading}
                  aria-describedby={error ? 'url-error' : undefined}
                />
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={loading || !url.trim()}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="animate-spin" aria-hidden="true">⟳</span>
                      Shortening…
                    </>
                  ) : (
                    <>
                      ✦ Shorten
                    </>
                  )}
                </button>
              </div>

              {/* Advanced options toggle */}
              <button
                type="button"
                className={styles.advancedToggle}
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                aria-controls="advanced-options"
              >
                {showAdvanced ? '▾' : '▸'} Advanced options
              </button>

              {/* Advanced options panel */}
              {showAdvanced && (
                <div id="advanced-options" className={styles.advancedSection}>
                  {/* Custom alias */}
                  <div className={styles.advancedField}>
                    <label htmlFor={aliasId} className={styles.fieldLabel}>
                      Custom alias <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(account required)</span>
                    </label>
                    <div className={styles.aliasGroup}>
                      <span className={styles.aliasPrefix}>shorty.sji.one/</span>
                      <input
                        id={aliasId}
                        type="text"
                        className={styles.aliasInput}
                        placeholder="my-link"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        maxLength={50}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Expiry date */}
                  <div className={styles.advancedField}>
                    <label htmlFor={expiryId} className={styles.fieldLabel}>
                      Expires at
                    </label>
                    <input
                      id={expiryId}
                      type="datetime-local"
                      className={`input ${styles.urlInput}`}
                      style={{ padding: '0.75rem 1rem' }}
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={minDate}
                    />
                  </div>
                </div>
              )}
            </form>

            {/* Error message */}
            {error && (
              <div id="url-error" className={styles.errorMsg} role="alert" aria-live="polite">
                ⚠ {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={styles.resultCard} role="region" aria-label="Shortened link result">
                <div className={styles.resultLabel}>✓ Link created</div>
                <div className={styles.resultRow}>
                  <a
                    href={result.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.shortUrl}
                  >
                    {result.shortUrl}
                  </a>
                  <button
                    onClick={handleCopy}
                    className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
                    aria-label={copied ? 'Copied!' : 'Copy short URL to clipboard'}
                    id="copy-short-url-btn"
                  >
                    {copied ? '✓ Copied!' : '⎘ Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className={styles.stats} aria-label="Platform statistics">
            <div className={styles.statItem}>
              <span className={styles.statValue}>10M+</span>
              <span className={styles.statLabel}>Links Created</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>&lt;5ms</span>
              <span className={styles.statLabel}>Avg. Redirect</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>99.9%</span>
              <span className={styles.statLabel}>Uptime</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>Free</span>
              <span className={styles.statLabel}>Always</span>
            </div>
          </div>

          {/* Feature cards */}
          <div className={`${styles.features} stagger-children`} aria-label="Key features">
            {[
              { icon: '⚡', title: 'Instant Redirects', desc: 'Redis-powered caching means your links resolve in under 5ms globally.' },
              { icon: '📊', title: 'Click Analytics', desc: 'Track every click with detailed statistics and access times.' },
              { icon: '⏱', title: 'Expiration Control', desc: 'Set links to expire automatically — perfect for time-sensitive content.' },
              { icon: '◻', title: 'QR Codes', desc: 'Generate print-ready QR codes for any of your links instantly.' },
            ].map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <span className={styles.featureIcon} aria-hidden="true">{f.icon}</span>
                <div className={styles.featureTitle}>{f.title}</div>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
  );
}
