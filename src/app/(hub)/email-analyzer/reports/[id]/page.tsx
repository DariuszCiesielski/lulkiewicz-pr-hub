'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Copy, Check, Edit3, Save, X, Download } from 'lucide-react';
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
    const fullMarkdown = sections
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

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
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
          <ArrowLeft className="h-4 w-4" /> Powrót do raportów
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

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => router.push('/email-analyzer/reports')}
        className="flex items-center gap-1.5 mb-4 text-sm hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Powrót do raportów
      </button>

      {/* Report header */}
      <div
        className="rounded-lg border p-4 mb-4"
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
            {report.mailbox && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {report.mailbox.display_name || report.mailbox.email_address}
              </p>
            )}
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
              {exporting ? 'Eksportuję...' : 'Pobierz .docx'}
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

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-lg border overflow-hidden"
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
            <div className="px-4 py-3">
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
                  className="prose prose-sm max-w-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content_markdown}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
