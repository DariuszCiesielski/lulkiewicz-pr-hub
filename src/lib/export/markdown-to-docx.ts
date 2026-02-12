/**
 * Markdown to DOCX converter.
 * Parses markdown line-by-line into docx library objects.
 * Supports: H1-H3, bullet/numbered lists, tables, bold/italic, separators.
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from 'docx';

type DocxChild = Paragraph | Table;

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5] }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function buildTable(rows: string[][]): Table {
  const tableRows = rows.map((cells, rowIndex) => {
    const isHeader = rowIndex === 0;
    return new TableRow({
      children: cells.map(
        (cellText) =>
          new TableCell({
            children: [
              new Paragraph({
                children: parseInlineFormatting(cellText),
                spacing: { before: 40, after: 40 },
              }),
            ],
            shading: isHeader
              ? { type: ShadingType.SOLID, color: 'E8E8E8' }
              : undefined,
          })
      ),
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}

export function markdownToDocxChildren(markdown: string): DocxChild[] {
  const lines = markdown.split('\n');
  const children: DocxChild[] = [];
  let bulletItems: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushBullets = () => {
    for (const item of bulletItems) {
      children.push(
        new Paragraph({
          children: parseInlineFormatting(`\u2022 ${item}`),
          spacing: { before: 60, after: 60 },
          indent: { left: 360 },
        })
      );
    }
    bulletItems = [];
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      children.push(buildTable(tableRows));
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      if (inTable) flushTable();
      continue;
    }

    // Table line
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushBullets();
      if (isTableSeparator(trimmed)) {
        inTable = true;
        continue;
      }
      const cells = parseTableRow(trimmed);
      tableRows.push(cells);
      inTable = true;
      continue;
    }

    if (inTable) flushTable();

    // Separator ---
    if (/^-{3,}$/.test(trimmed)) {
      flushBullets();
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '\u2500'.repeat(50),
              color: 'CCCCCC',
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        })
      );
      continue;
    }

    // H1
    if (trimmed.startsWith('# ')) {
      flushBullets();
      children.push(
        new Paragraph({
          text: trimmed.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      flushBullets();
      children.push(
        new Paragraph({
          text: trimmed.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      flushBullets();
      children.push(
        new Paragraph({
          text: trimmed.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      bulletItems.push(trimmed.substring(2));
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      flushBullets();
      children.push(
        new Paragraph({
          children: parseInlineFormatting(trimmed),
          spacing: { before: 60, after: 60 },
          indent: { left: 360 },
        })
      );
      continue;
    }

    // Regular text
    flushBullets();
    children.push(
      new Paragraph({
        children: parseInlineFormatting(trimmed),
        spacing: { before: 80, after: 80 },
      })
    );
  }

  flushBullets();
  if (inTable) flushTable();

  return children;
}
