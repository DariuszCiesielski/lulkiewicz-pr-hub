/**
 * Export a report (with sections) to a .docx file.
 * Client-side: uses the `docx` library + `file-saver`.
 *
 * v2: Professional formatting with document styles, page margins,
 *     section numbering, and improved typography.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { markdownToDocxChildren } from './markdown-to-docx';

// ── Typography constants ─────────────────────────────────────────────────────

const FONT = 'Calibri';

const COLOR = {
  TITLE: '1F3864',
  SUBTITLE: '555555',
  SECTION_HEADING: '1F3864',
  META: '777777',
  FOOTER: '999999',
  SEPARATOR: 'CCCCCC',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportSection {
  title: string;
  content_markdown: string;
  section_order: number;
}

interface ReportMeta {
  title: string;
  template_type?: string;
  mailbox?: { display_name: string | null; email_address: string } | null;
  date_range_from?: string | null;
  date_range_to?: string | null;
  created_at: string;
}

// ── Filename helpers ─────────────────────────────────────────────────────────

/**
 * Generate a unique DOCX filename: Raport_typ_skrzynka_data-zakres.docx
 * Polish chars preserved, special chars sanitized.
 */
function generateDocxFilename(report: ReportMeta): string {
  const templateLabel = report.template_type === 'client' ? 'kliencki' : 'wewnetrzny';

  const mailboxName = report.mailbox?.display_name || report.mailbox?.email_address || 'skrzynka';
  const safeMailbox = sanitizeForFilename(mailboxName);

  const parts = ['Raport', templateLabel, safeMailbox];

  // Add date range if available
  if (report.date_range_from && report.date_range_to) {
    const from = formatDateShort(report.date_range_from);
    const to = formatDateShort(report.date_range_to);
    parts.push(`${from}_${to}`);
  } else {
    // Fallback: use created_at date
    parts.push(formatDateShort(report.created_at));
  }

  return `${parts.join('_')}.docx`;
}

/** Format date as YYYY-MM-DD for filenames */
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'nieznana-data';
  return d.toISOString().split('T')[0];
}

/**
 * Sanitize text for use in filenames.
 * Preserves Polish characters, removes special chars, replaces spaces with underscores.
 */
function sanitizeForFilename(text: string): string {
  return text
    .replace(/[<>:"/\\|?*]/g, '')     // Remove forbidden filename chars
    .replace(/[@#$%^&+=!~`'{}[\]()]/g, '') // Remove other special chars
    .replace(/\s+/g, '_')             // Spaces → underscores
    .replace(/_+/g, '_')              // Collapse multiple underscores
    .replace(/^_|_$/g, '')            // Trim leading/trailing underscores
    .slice(0, 80);                    // Limit length
}

// ── Main export function ─────────────────────────────────────────────────────

export async function exportReportToDocx(
  report: ReportMeta,
  sections: ReportSection[]
) {
  const sorted = [...sections].sort((a, b) => a.section_order - b.section_order);

  const children: (Paragraph | InstanceType<typeof import('docx').Table>)[] = [];

  // ── Title area ──

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: report.title,
          bold: true,
          font: FONT,
          size: 48, // 24pt
          color: COLOR.TITLE,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Mailbox name
  const mailboxName =
    report.mailbox?.display_name || report.mailbox?.email_address || '';
  if (mailboxName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: mailboxName,
            italics: true,
            font: FONT,
            size: 26, // 13pt
            color: COLOR.SUBTITLE,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );
  }

  // Generated date
  const createdDate = new Date(report.created_at).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Wygenerowano: ${createdDate}`,
          italics: true,
          font: FONT,
          size: 22, // 11pt
          color: COLOR.META,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  // Date range
  if (report.date_range_from && report.date_range_to) {
    const from = new Date(report.date_range_from).toLocaleDateString('pl-PL');
    const to = new Date(report.date_range_to).toLocaleDateString('pl-PL');
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Okres analizy: ${from} \u2013 ${to}`,
            italics: true,
            font: FONT,
            size: 22,
            color: COLOR.META,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  }

  // Separator after header
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '\u2500'.repeat(60),
          color: COLOR.SEPARATOR,
          size: 16,
          font: FONT,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
    })
  );

  // ── Sections ──

  for (const section of sorted) {
    // Section heading with number
    const sectionNumber = section.section_order;
    const headingText = sectionNumber > 0
      ? `${sectionNumber}. ${section.title}`
      : section.title;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: headingText,
            bold: true,
            font: FONT,
            size: 36, // 18pt
            color: COLOR.SECTION_HEADING,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480, after: 240 },
      })
    );

    // Section content (markdown -> docx)
    const sectionChildren = markdownToDocxChildren(section.content_markdown);
    children.push(...sectionChildren);
  }

  // ── Footer ──

  children.push(new Paragraph({ text: '', spacing: { before: 600 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '\u2500'.repeat(60), color: COLOR.SEPARATOR, size: 16, font: FONT }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Raport wygenerowany przez Lulkiewicz PR Hub',
          italics: true,
          font: FONT,
          size: 20, // 10pt
          color: COLOR.FOOTER,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    })
  );

  // ── Build document ──

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = generateDocxFilename(report);
  saveAs(blob, filename);
}
