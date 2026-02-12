/**
 * Export a report (with sections) to a .docx file.
 * Client-side: uses the `docx` library + `file-saver`.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { markdownToDocxChildren } from './markdown-to-docx';

interface ReportSection {
  title: string;
  content_markdown: string;
  section_order: number;
}

interface ReportMeta {
  title: string;
  mailbox?: { display_name: string | null; email_address: string } | null;
  date_range_from?: string | null;
  date_range_to?: string | null;
  created_at: string;
}

export async function exportReportToDocx(
  report: ReportMeta,
  sections: ReportSection[]
) {
  const sorted = [...sections].sort((a, b) => a.section_order - b.section_order);

  const children: (Paragraph | InstanceType<typeof import('docx').Table>)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: report.title,
      heading: HeadingLevel.TITLE,
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
          new TextRun({ text: mailboxName, italics: true, size: 22, color: '666666' }),
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
          size: 20,
          color: '888888',
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
            text: `Okres: ${from} \u2013 ${to}`,
            italics: true,
            size: 20,
            color: '888888',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  } else {
    children.push(new Paragraph({ text: '', spacing: { after: 300 } }));
  }

  // Sections
  for (const section of sorted) {
    // Section heading
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Section content (markdown -> docx)
    const sectionChildren = markdownToDocxChildren(section.content_markdown);
    children.push(...sectionChildren);
  }

  // Footer
  children.push(new Paragraph({ text: '', spacing: { before: 600 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '\u2500'.repeat(50), color: 'CCCCCC', size: 16 }),
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
          size: 18,
          color: '999999',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    })
  );

  // Build document
  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const date = new Date().toISOString().split('T')[0];
  const safeName = (mailboxName || 'raport')
    .replace(/[^a-zA-Z0-9\u0080-\uFFFF\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  saveAs(blob, `raport-${safeName}-${date}.docx`);
}
