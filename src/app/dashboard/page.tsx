'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { QRModal } from '@/components/dashboard/QRModal';

interface LinkItem {
  _id: string;
  code: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  clickCount: number;
  persistedClicks?: number;
  pendingClicks?: number;
  lastAccessedAt: string | null;
  customAlias: boolean;
}

export default function DashboardPage() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');

  // New link form state
  const [newUrl, setNewUrl] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // QR Modal state
  const [qrLink, setQrLink] = useState<{ url: string; code: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/v1/links${query}`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
      }
    } catch (err) {
      console.error('Failed to load links', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetch(`/api/v1/links${query}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setLinks(data.links || []);
        }
      } catch (err) {
        console.error('Failed to load links', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      const body: Record<string, string> = { url: newUrl.trim() };
      if (newAlias.trim()) body.customAlias = newAlias.trim();
      if (newExpiry) body.expiresAt = newExpiry;

      const res = await fetch('/api/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create link');
      } else {
        setNewUrl('');
        setNewAlias('');
        setNewExpiry('');
        setShowCreateForm(false);
        fetchLinks();
      }
    } catch {
      setCreateError('An unexpected error occurred');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleActive = async (link: LinkItem) => {
    try {
      const res = await fetch(`/api/v1/links/${link._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !link.isActive }),
      });

      if (res.ok) {
        setLinks((prev) =>
          prev.map((item) => (item._id === link._id ? { ...item, isActive: !item.isActive } : item)),
        );
      }
    } catch (err) {
      console.error('Failed to toggle active state', err);
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this short link?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/links/${linkId}`, { method: 'DELETE' });
      if (res.ok) {
        setLinks((prev) => prev.filter((item) => item._id !== linkId));
      }
    } catch (err) {
      console.error('Failed to delete link', err);
    }
  };

  const handleCopy = (code: string) => {
    const fullUrl = `${window.location.origin}/${code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered links
  const filteredLinks = links.filter((link) => {
    if (activeTab === 'active') return link.isActive;
    if (activeTab === 'inactive') return !link.isActive;
    return true;
  });

  // Calculate metrics
  const totalClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);
  const totalPending = links.reduce((sum, l) => sum + (l.pendingClicks || 0), 0);
  const totalPersisted = links.reduce((sum, l) => sum + (l.persistedClicks ?? l.clickCount ?? 0), 0);
  const activeCount = links.filter((l) => l.isActive).length;

  return (
    <div>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage your links, review real-time clicks, and generate QR codes
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm((prev) => !prev)}
        >
          {showCreateForm ? '✕ Close Form' : '+ Shorten New Link'}
        </Button>
      </div>

      {/* Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Links
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {links.length}
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Clicks
            </span>
            {totalPending > 0 && (
              <span
                title="Clicks currently cached in Redis awaiting background persistence to MongoDB"
                style={{ fontSize: '0.6875rem', color: 'var(--brand-secondary)', fontWeight: 600 }}
              >
                +{totalPending} pending sync
              </span>
            )}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--brand-secondary)', marginTop: '0.25rem' }}>
            {totalClicks.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
            Combined real-time ({totalPersisted.toLocaleString()} persisted in DB)
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Links
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>
            {activeCount}
          </div>
        </div>
      </div>

      {/* Collapsible Create Form */}
      {showCreateForm && (
        <div
          className="card card-glass"
          style={{
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-8)',
            border: '1px solid var(--brand-primary-glow)',
          }}
        >
          <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1.25rem' }}>
            Create a Short Link
          </h3>

          {createError && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                border: '1px solid hsl(0, 84%, 65%, 0.3)',
                fontSize: '0.875rem',
                marginBottom: 'var(--space-4)',
              }}
            >
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <Input
                label="Destination URL *"
                placeholder="https://example.com/very-long-url-to-shorten"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                required
              />
              <Input
                label="Custom Alias (optional)"
                placeholder="my-cool-link"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                hint="Alphanumeric, dashes, underscores"
              />
              <Input
                label="Expiration Date (optional, max 30 days)"
                type="datetime-local"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                hint="Leave blank for a permanent link"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createLoading}
              >
                Create Link
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'var(--surface-3)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: activeTab === tab ? 'var(--border-strong)' : 'transparent',
                padding: '0.375rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ minWidth: '260px' }}>
          <Input
            placeholder="Search code or destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.5rem 0.75rem' }}
          />
        </div>
      </div>

      {/* Links Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Loading your links...</p>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              {search ? 'No links matching your search.' : 'No short links yet.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateForm(true)}
            >
              Create your first link
            </Button>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Short Link</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Destination</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Clicks</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Expires</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.map((link) => {
                const isExpired = link.expiresAt && new Date(link.expiresAt) <= new Date();

                return (
                  <tr
                    key={link._id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Link
                          href={`/${link.code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        >
                          /{link.code}
                        </Link>
                        <button
                          onClick={() => handleCopy(link.code)}
                          title="Copy short link"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedCode === link.code ? 'var(--color-success)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {copiedCode === link.code ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', maxWidth: '300px' }}>
                      <span
                        title={link.originalUrl}
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {link.originalUrl}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--brand-secondary)' }}>
                      <div>{link.clickCount.toLocaleString()}</div>
                      {link.pendingClicks !== undefined && link.pendingClicks > 0 ? (
                        <div
                          title={`Persisted in DB: ${link.persistedClicks?.toLocaleString() ?? (link.clickCount - link.pendingClicks).toLocaleString()} | Cached pending sync: ${link.pendingClicks.toLocaleString()}`}
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            marginTop: '0.125rem',
                          }}
                        >
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }} />
                          +{link.pendingClicks.toLocaleString()} pending
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {isExpired ? (
                        <Badge variant="danger">Expired</Badge>
                      ) : link.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="warning">Disabled</Badge>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'Permanent'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setQrLink({
                              url: `${typeof window !== 'undefined' ? window.location.origin : ''}/${link.code}`,
                              code: link.code,
                            })
                          }
                          title="View QR Code"
                        >
                          QR
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleActive(link)}
                          title={link.isActive ? 'Disable link' : 'Enable link'}
                        >
                          {link.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(link._id)}
                          title="Delete link permanently"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-2)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              * Click counts reflect combined real-time clicks (persisted in MongoDB + pending Redis cache increments awaiting eventual synchronization).
            </div>
          </>
        )}
      </div>

      {/* QR Code Modal */}
      {qrLink && (
        <QRModal
          url={qrLink.url}
          code={qrLink.code}
          onClose={() => setQrLink(null)}
        />
      )}
    </div>
  );
}
