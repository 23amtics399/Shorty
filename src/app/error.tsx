'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

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
        <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: 'var(--space-3)' }}>
          ⚠️
        </span>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
          An unexpected error occurred while processing your request.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => reset()}>
            Try Again
          </Button>
          <Link href="/" className="btn btn-secondary">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
