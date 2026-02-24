/**
 * Markdown to DOCX converter.
 * Parses markdown line-by-line into docx library objects.
 * Supports: H1-H3, bullet/numbered lists, tables, bold/italic, separators.
 *
 * v2: Professional formatting with explicit font sizes and typography.
 *     - Calibri 12pt body text
 *     - Proper heading hierarchy (H2/H3 for subsections)
 *     - Bullet support for -, *, and • prefixes
 *     - Improved table styling with header shading
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
  TableLayoutType,
} from 'docx';

type DocxChild = Paragraph | Table;

// ── Typography constants ─────────────────────────────────────────────────────

const FONT = 'Calibri';

/** Font sizes in half-points (24 = 12pt, 28 = 14pt, etc.) */
const SIZE = {
  H2: 28,       // 14pt — subsection heading (## in content)
  H3: 24,       // 12pt — sub-subsection heading (### in content, bold distinguishes)
  BODY: 24,     // 12pt
  BULLET: 24,   // 12pt
  TABLE: 22,    // 11pt
};

const COLOR = {
  H2: '2B579A',
  H3: '404040',
  BODY: '333333',
  BULLET_DOT: '2B579A',
  SEPARATOR: 'CCCCCC',
  TABLE_HEADER_BG: 'E8EDF5',
  TABLE_HEADER_TEXT: '1F3864',
  TABLE_BORDER: 'BFBFBF',
};

/** 1.15 line spacing (in 240ths of a line) */
const LINE_SPACING = 276;

// ── Inline formatting ────────────────────────────────────────────────────────

function parseInlineFormatting(
  text: string,
  options?: { size?: number; color?: string }
): TextRun[] {
  const fontSize = options?.size ?? SIZE.BODY;
  const fontColor = options?.color ?? COLOR.BODY;
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true, font: FONT, size: fontSize, color: fontColor }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true, font: FONT, size: fontSize, color: fontColor }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true, font: FONT, size: fontSize, color: fontColor }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: FONT, size: fontSize, color: fontColor }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, font: FONT, size: fontSize, color: fontColor })];
}

// ── Table helpers ────────────────────────────────────────────────────────────

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

/** A4 text width in DXA (twips) with default 1-inch margins: ~6.3 inches = 9072 DXA */
const TABLE_PAGE_WIDTH_DXA = 9072;

function buildTable(rows: string[][]): Table {
  const colCount = rows[0]?.length || 1;
  const colWidth = Math.floor(TABLE_PAGE_WIDTH_DXA / colCount);
  const columnWidths = Array(colCount).fill(colWidth);

  const tableRows = rows.map((cells, rowIndex) => {
    const isHeader = rowIndex === 0;
    return new TableRow({
      children: cells.map(
        (cellText) =>
          new TableCell({
            children: [
              new Paragraph({
                children: parseInlineFormatting(cellText, {
                  size: SIZE.TABLE,
                  color: isHeader ? COLOR.TABLE_HEADER_TEXT : COLOR.BODY,
                }),
                spacing: { before: 60, after: 60 },
              }),
            ],
            width: { size: colWidth, type: WidthType.DXA },
            shading: isHeader
              ? { type: ShadingType.SOLID, color: COLOR.TABLE_HEADER_BG }
              : undefined,
          })
      ),
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLOR.TABLE_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR.TABLE_BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLOR.TABLE_BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLOR.TABLE_BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLOR.TABLE_BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLOR.TABLE_BORDER },
    },
  });
}

// ── Main converter ───────────────────────────────────────────────────────────

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
          children: [
            new TextRun({ text: '\u2022  ', font: FONT, size: SIZE.BULLET, color: COLOR.BULLET_DOT }),
            ...parseInlineFormatting(item, { size: SIZE.BULLET }),
          ],
          spacing: { before: 40, after: 40, line: LINE_SPACING },
          indent: { left: 400, hanging: 260 },
        })
      );
    }
    bulletItems = [];
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      children.push(buildTable(tableRows));
      children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
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
              color: COLOR.SEPARATOR,
              size: 16,
              font: FONT,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
        })
      );
      continue;
    }

    // H3 (### — sub-subsection, check first — most specific)
    if (trimmed.startsWith('### ')) {
      flushBullets();
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.substring(4),
              bold: true,
              font: FONT,
              size: SIZE.H3,
              color: COLOR.H3,
            }),
          ],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120, line: LINE_SPACING },
        })
      );
      continue;
    }

    // H2 (## — subsection heading)
    if (trimmed.startsWith('## ')) {
      flushBullets();
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.substring(3),
              bold: true,
              font: FONT,
              size: SIZE.H2,
              color: COLOR.H2,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 160, line: LINE_SPACING },
        })
      );
      continue;
    }

    // H1 (# — rare in section content, downgrade to H2 visual level)
    if (trimmed.startsWith('# ')) {
      flushBullets();
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.substring(2),
              bold: true,
              font: FONT,
              size: SIZE.H2,
              color: COLOR.H2,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 160, line: LINE_SPACING },
        })
      );
      continue;
    }

    // Bullet list: -, *, or Unicode bullet
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      bulletItems.push(trimmed.substring(2));
      continue;
    }
    if (trimmed.startsWith('\u2022 ') || trimmed.startsWith('\u2022\t')) {
      bulletItems.push(trimmed.substring(2).trim());
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      flushBullets();
      children.push(
        new Paragraph({
          children: parseInlineFormatting(trimmed, { size: SIZE.BODY }),
          spacing: { before: 40, after: 40, line: LINE_SPACING },
          indent: { left: 400, hanging: 300 },
        })
      );
      continue;
    }

    // Regular text (prose paragraph)
    flushBullets();
    children.push(
      new Paragraph({
        children: parseInlineFormatting(trimmed, { size: SIZE.BODY }),
        spacing: { before: 100, after: 100, line: LINE_SPACING },
      })
    );
  }

  flushBullets();
  if (inTable) flushTable();

  return children;
}
