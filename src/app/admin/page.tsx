'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { ReportStatus } from '@/types';

interface ReportItem {
  _id: string;
  linkCode: string;
  originalUrl: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

interface AdminLinkItem {
  _id: string;
  code: string;
  originalUrl: string;
  isActive: boolean;
  clickCount: number;
  persistedClicks?: number;
  pendingClicks?: number;
  createdAt: string;
  ownerId: string | null;
}

export default function AdminPage() {
  const [activeView, setActiveView] = useState<'reports' | 'links'>('reports');

  // Reports state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportFilter, setReportFilter] = useState<string>('pending');
  const [reportsLoading, setReportsLoading] = useState(true);

  // Links state
  const [links, setLinks] = useState<AdminLinkItem[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (activeView === 'reports') {
        try {
          const url = reportFilter
            ? `/api/v1/admin/reports?status=${encodeURIComponent(reportFilter)}`
            : '/api/v1/admin/reports';
          const res = await fetch(url);
          if (res.ok && isMounted) {
            const data = await res.json();
            setReports(data.reports || []);
          }
        } catch (err) {
          console.error('Failed to load reports', err);
        } finally {
          if (isMounted) setReportsLoading(false);
        }
      } else {
        try {
          const url = linkSearch
            ? `/api/v1/admin/links?search=${encodeURIComponent(linkSearch)}`
            : '/api/v1/admin/links';
          const res = await fetch(url);
          if (res.ok && isMounted) {
            const data = await res.json();
            setLinks(data.links || []);
          }
        } catch (err) {
          console.error('Failed to load system links', err);
        } finally {
          if (isMounted) setLinksLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [activeView, reportFilter, linkSearch]);

  const handleUpdateReportStatus = async (reportId: string, status: ReportStatus) => {
    try {
      const res = await fetch(`/api/v1/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r._id === reportId ? { ...r, status } : r)),
        );
      }
    } catch (err) {
      console.error('Failed to update report status', err);
    }
  };

  const handleToggleLinkActive = async (link: AdminLinkItem) => {
    try {
      const res = await fetch(`/api/v1/links/${link._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !link.isActive }),
      });

      if (res.ok) {
        setLinks((prev) =>
          prev.map((l) => (l._id === link._id ? { ...l, isActive: !l.isActive } : l)),
        );
      }
    } catch (err) {
      console.error('Failed to toggle link active state', err);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Delete this link permanently as admin?')) return;

    try {
      const res = await fetch(`/api/v1/links/${linkId}`, { method: 'DELETE' });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l._id !== linkId));
      }
    } catch (err) {
      console.error('Failed to delete link', err);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
          Admin Console <Badge variant="warning">Staff</Badge>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review abuse reports, moderate user content, and monitor short links.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <button
          onClick={() => setActiveView('reports')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeView === 'reports' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeView === 'reports' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Abuse Reports
        </button>
        <button
          onClick={() => setActiveView('links')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeView === 'links' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeView === 'links' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          System Links
        </button>
      </div>

      {/* Reports View */}
      {activeView === 'reports' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
            {(['pending', 'reviewed', 'actioned', 'dismissed', ''] as const).map((filter) => (
              <button
                key={filter || 'all'}
                onClick={() => setReportFilter(filter)}
                style={{
                  background: reportFilter === filter ? 'var(--surface-3)' : 'transparent',
                  color: reportFilter === filter ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: reportFilter === filter ? 'var(--border-strong)' : 'transparent',
                  padding: '0.375rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {filter || 'All Reports'}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            {reportsLoading ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No abuse reports in this category.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reported URL</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reason</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)' }}>
                        <Link href={`/${report.linkCode}`} target="_blank" rel="noopener noreferrer">
                          /{report.linkCode}
                        </Link>
                      </td>
                      <td style={{ padding: '1rem', maxWidth: '280px' }}>
                        <span
                          title={report.originalUrl}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {report.originalUrl}
                        </span>
                        {report.details && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            Note: {report.details}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <Badge variant="danger">{report.reason}</Badge>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <Badge
                          variant={
                            report.status === 'actioned'
                              ? 'danger'
                              : report.status === 'dismissed'
                              ? 'neutral'
                              : report.status === 'reviewed'
                              ? 'info'
                              : 'warning'
                          }
                        >
                          {report.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUpdateReportStatus(report._id, 'dismissed')}
                            disabled={report.status === 'dismissed'}
                          >
                            Dismiss
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleUpdateReportStatus(report._id, 'actioned')}
                            disabled={report.status === 'actioned'}
                          >
                            Action
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* System Links View */}
      {activeView === 'links' && (
        <div>
          <div style={{ maxWidth: '360px', marginBottom: 'var(--space-4)' }}>
            <Input
              placeholder="Search code, destination, or owner ID..."
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            {linksLoading ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Searching links...</p>
              </div>
            ) : links.length === 0 ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No links found.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Short Link</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Destination</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Clicks</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Owner</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        <Link href={`/${link.code}`} target="_blank" rel="noopener noreferrer">
                          /{link.code}
                        </Link>
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
                        {link.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="warning">Disabled</Badge>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                        {link.ownerId ? 'Registered' : 'Anonymous'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleLinkActive(link)}
                          >
                            {link.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteLink(link._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
