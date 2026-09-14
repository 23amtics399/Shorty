'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';

interface QRModalProps {
  url: string;
  code: string;
  onClose: () => void;
}

export function QRModal({ url, code, onClose }: QRModalProps) {
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [svgString, setSvgString] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function generateQRCodes() {
      try {
        setLoading(true);
        const [png, svg] = await Promise.all([
          QRCode.toDataURL(url, {
            width: 320,
            margin: 2,
            color: {
              dark: '#0d0e14',
              light: '#ffffff',
            },
          }),
          QRCode.toString(url, {
            type: 'svg',
            margin: 2,
            color: {
              dark: '#0d0e14',
              light: '#ffffff',
            },
          }),
        ]);

        if (isMounted) {
          setPngDataUrl(png);
          setSvgString(svg);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to generate QR code', err);
        if (isMounted) setLoading(false);
      }
    }

    generateQRCodes();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [url, onClose]);

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const link = document.createElement('a');
    link.download = `shorty-${code}-qr.png`;
    link.href = pngDataUrl;
    link.click();
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `shorty-${code}-qr.svg`;
    link.href = blobUrl;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card card-glass"
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '2rem',
          textAlign: 'center',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close QR Modal"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          ✕
        </button>

        <h3 id="qr-modal-title" style={{ marginBottom: '0.5rem' }}>
          QR Code
        </h3>
        <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
          <code style={{ color: 'var(--brand-primary)' }}>{url}</code>
        </p>

        <div
          style={{
            background: '#ffffff',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '260px',
            minWidth: '260px',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {loading ? (
            <div className="spinner" />
          ) : pngDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={pngDataUrl}
              alt={`QR Code for ${url}`}
              style={{ width: '240px', height: '240px', display: 'block' }}
            />
          ) : (
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Failed to load QR code</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Button variant="primary" size="sm" onClick={handleDownloadPng} disabled={!pngDataUrl}>
            Download PNG
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadSvg} disabled={!svgString}>
            Download SVG
          </Button>
        </div>
      </div>
    </div>
  );
}
