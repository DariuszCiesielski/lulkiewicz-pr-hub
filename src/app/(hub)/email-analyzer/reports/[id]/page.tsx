'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Copy, Check, Edit3, Save, X, Download, List } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exportReportToDocx } from '@/lib/export/export-report-docx';

interface ReportSection {
  id: string;
  section_key: string;
  section_order: number;
  title: string;
  content_markdown: string;
  is_edited: boolean;
}

interface Report {
  id: string;
  title: string;
  template_type: string;
  status: string;
  date_range_from: string | null;
  date_range_to: string | null;
  created_at: string;
  mailbox?: { display_name: string | null; email_address: string };
}

/** Generate a URL-safe anchor ID from section key */
function sectionAnchor(sectionKey: string): string {
  return `section-${sectionKey}`;
}

export default function ReportDetailPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showToc, setShowToc] = useState(true);

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.section_order - b.section_order),
    [sections]
  );

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin || !reportId) return;
    setIsLoading(true);
    fetch(`/api/reports/${reportId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Nie znaleziono raportu');
        return res.json();
      })
      .then((data) => {
        setReport(data.report);
        setSections(data.sections);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isAdmin, reportId]);

  const handleEdit = (section: ReportSection) => {
    setEditingSection(section.id);
    setEditContent(section.content_markdown);
  };

  const handleSave = async () => {
    if (!editingSection) return;

    const res = await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: editingSection,
        content_markdown: editContent,
      }),
    });

    if (res.ok) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === editingSection
            ? { ...s, content_markdown: editContent, is_edited: true }
            : s
        )
      );
      setEditingSection(null);
    }
  };

  const handleCopyAll = () => {
    const fullMarkdown = sortedSections
      .map((s) => `## ${s.title}\n\n${s.content_markdown}`)
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(fullMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportDocx = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportReportToDocx(report, sections);
    } catch (err) {
      console.error('DOCX export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const scrollToSection = (sectionKey: string) => {
    const el = document.getElementById(sectionAnchor(sectionKey));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ladowanie...</p>
      </div>
    );
  }

  if (!isAdmin || error || !report) {
    return (
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push('/email-analyzer/reports')}
          className="flex items-center gap-1.5 mb-4 text-sm hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Powrot do raportow
        </button>
        {error && (
          <div
            className="rounded-md border p-3 text-sm"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  // Format date range for display
  const dateRangeText =
    report.date_range_from && report.date_range_to
      ? `${new Date(report.date_range_from).toLocaleDateString('pl-PL')} — ${new Date(report.date_range_to).toLocaleDateString('pl-PL')}`
      : null;

  const createdText = new Date(report.created_at).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => router.push('/email-analyzer/reports')}
        className="flex items-center gap-1.5 mb-4 text-sm hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Powrot do raportow
      </button>

      {/* Report header */}
      <div
        className="rounded-lg border p-5 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {report.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              {report.mailbox && (
                <span>{report.mailbox.display_name || report.mailbox.email_address}</span>
              )}
              <span>{createdText}</span>
              {dateRangeText && (
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                  }}
                >
                  {dateRangeText}
                </span>
              )}
              <span
                className="rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: report.template_type === 'internal'
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                  color: report.template_type === 'internal' ? '#3b82f6' : '#22c55e',
                }}
              >
                {report.template_type === 'internal' ? 'Wewnetrzny' : 'Kliencki'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportDocx}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
              style={{
                borderColor: 'var(--accent-primary)',
                color: 'var(--accent-primary)',
              }}
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Eksportuje...' : 'Pobierz .docx'}
            </button>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              {copied ? <Check className="h-4 w-4" style={{ color: '#22c55e' }} /> : <Copy className="h-4 w-4" />}
              {copied ? 'Skopiowano!' : 'Kopiuj raport'}
            </button>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      {sortedSections.length > 1 && (
        <div
          className="rounded-lg border mb-4 overflow-hidden"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <button
            onClick={() => setShowToc(!showToc)}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:opacity-80"
            style={{
              color: 'var(--text-primary)',
              borderBottom: showToc ? '1px solid var(--border-primary)' : 'none',
            }}
          >
            <List className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            Spis tresci ({sortedSections.length} sekcji)
          </button>
          {showToc && (
            <nav className="px-4 py-3">
              <ol className="space-y-1">
                {sortedSections.map((section, idx) => (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.section_key)}
                      className="text-sm hover:underline text-left"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      {idx + 1}. {section.title}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-6">
        {sortedSections.map((section, idx) => (
          <div key={section.id}>
            {/* Visual separator between sections */}
            {idx > 0 && (
              <div
                className="mb-6"
                style={{
                  borderTop: '2px solid var(--border-primary)',
                  opacity: 0.5,
                }}
              />
            )}

            <div
              id={sectionAnchor(section.section_key)}
              className="rounded-lg border overflow-hidden scroll-mt-4"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              {/* Section header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border-primary)' }}
              >
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  <span className="mr-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}.</span>
                  {section.title}
                  {section.is_edited && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      (edytowano)
                    </span>
                  )}
                </h2>
                {editingSection === section.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={handleSave}
                      className="p-1 rounded hover:opacity-80"
                      style={{ color: '#22c55e' }}
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingSection(null)}
                      className="p-1 rounded hover:opacity-80"
                      style={{ color: '#ef4444' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEdit(section)}
                    className="p-1 rounded hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Section content */}
              <div className="px-5 py-4">
                {editingSection === section.id ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-y font-mono min-h-[200px]"
                    style={{
                      borderColor: 'var(--border-primary)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                ) : (
                  <div
                    className="prose prose-sm max-w-none report-content"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {section.content_markdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report content styles */}
      <style jsx global>{`
        .report-content h1,
        .report-content h2,
        .report-content h3 {
          color: var(--text-primary);
          margin-top: 1.25em;
          margin-bottom: 0.5em;
        }
        .report-content h1 { font-size: 1.25rem; font-weight: 700; }
        .report-content h2 { font-size: 1.1rem; font-weight: 600; }
        .report-content h3 { font-size: 1rem; font-weight: 600; }
        .report-content p { margin-bottom: 0.75em; line-height: 1.65; }
        .report-content ul,
        .report-content ol { margin-bottom: 0.75em; padding-left: 1.5em; }
        .report-content li { margin-bottom: 0.25em; line-height: 1.5; }
        .report-content strong { color: var(--text-primary); }
        .report-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
          font-size: 0.85rem;
        }
        .report-content th,
        .report-content td {
          border: 1px solid var(--border-primary);
          padding: 0.5em 0.75em;
          text-align: left;
        }
        .report-content th {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-weight: 600;
        }
        .report-content hr {
          border: none;
          border-top: 1px solid var(--border-primary);
          margin: 1.5em 0;
        }
        .report-content blockquote {
          border-left: 3px solid var(--accent-primary);
          padding-left: 1em;
          margin: 1em 0;
          color: var(--text-muted);
          font-style: italic;
        }
        .report-content code {
          background-color: var(--bg-primary);
          padding: 0.15em 0.3em;
          border-radius: 3px;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}
