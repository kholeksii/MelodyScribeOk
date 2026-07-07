import jsPDF from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import frauncesUrl from '../assets/fonts/Fraunces-Title.ttf?url';
import { ProjectMetadata } from '../types';
import { TFunc, instrumentLabel } from '../i18n';

// A4 portrait, all values in mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const USABLE_W = PAGE_W - 2 * MARGIN;
const TITLE_BLOCK_H = 28;

// Screen-only colors (confidence heatmap, selection, hover) → print black
const SCREEN_COLORS = new Set(['#16a34a', '#d97706', '#dc2626', '#2563eb', '#6b7280']);

let frauncesBase64: string | null = null;

/** Embed Fraunces for the title; falls back to Times if the font can't load. */
async function loadTitleFont(doc: jsPDF): Promise<string> {
  try {
    if (!frauncesBase64) {
      const res = await fetch(frauncesUrl);
      if (!res.ok) throw new Error(`font fetch: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      frauncesBase64 = btoa(binary);
    }
    doc.addFileToVFS('Fraunces.ttf', frauncesBase64);
    doc.addFont('Fraunces.ttf', 'Fraunces', 'normal');
    return 'Fraunces';
  } catch {
    return 'times';
  }
}

/** Clone the score SVG with screen-state colors flattened to print black. */
function printClone(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll<SVGElement>('[fill], [stroke]').forEach((el) => {
    const fill = el.getAttribute('fill')?.toLowerCase();
    const stroke = el.getAttribute('stroke')?.toLowerCase();
    if (fill && SCREEN_COLORS.has(fill)) el.setAttribute('fill', '#000000');
    if (stroke && SCREEN_COLORS.has(stroke)) el.setAttribute('stroke', '#000000');
    if (el.getAttribute('opacity')) el.setAttribute('opacity', '1');
  });
  return clone;
}

/**
 * Y positions (svg units) where a page may break without cutting a stave:
 * midpoints between consecutive systems, measured on the live SVG.
 */
function safeBreaks(svg: SVGSVGElement, svgHeight: number): number[] {
  const tops: number[] = [];
  svg.querySelectorAll<SVGGraphicsElement>('.vf-stave').forEach((stave) => {
    try {
      const y = stave.getBBox().y;
      if (!tops.some((t) => Math.abs(t - y) < 10)) tops.push(y);
    } catch {
      // getBBox throws on detached/hidden elements — skip
    }
  });
  tops.sort((a, b) => a - b);
  // Cut just above each following system (leaves room for its high notes)
  const breaks = tops.slice(1).map((top) => top - 35);
  return breaks.filter((b) => b > 0 && b < svgHeight);
}

/** Greedy pagination: each slice ends at the last safe break that fits. */
function sliceHeights(svgHeight: number, breaks: number[], firstMax: number, otherMax: number): number[] {
  const slices: number[] = [];
  let top = 0;
  while (svgHeight - top > (slices.length === 0 ? firstMax : otherMax)) {
    const max = slices.length === 0 ? firstMax : otherMax;
    const candidates = breaks.filter((b) => b > top && b - top <= max);
    const cut = candidates.length > 0 ? candidates[candidates.length - 1] : top + max;
    slices.push(cut - top);
    top = cut;
  }
  slices.push(svgHeight - top);
  return slices;
}

export async function exportScorePdf(
  svgEl: SVGSVGElement,
  metadata: ProjectMetadata,
  t: TFunc,
  locale: string
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const titleFont = await loadTitleFont(doc);

  // ── Title block ──
  doc.setFont(titleFont, 'normal');
  doc.setFontSize(22);
  doc.setTextColor(43, 42, 38); // ink
  doc.text(metadata.title, PAGE_W / 2, MARGIN + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 103, 94); // ink-soft
  const metaLine = `${instrumentLabel(metadata.instrument, t)}  ·  ${metadata.tempo} BPM  ·  ${metadata.key}  ·  ${metadata.timeSignature}`;
  doc.text(metaLine, PAGE_W / 2, MARGIN + 15, { align: 'center' });

  const date = new Date().toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setFontSize(9);
  doc.text(t('pdfDate', { date }), PAGE_W / 2, MARGIN + 20, { align: 'center' });

  // ── Score, paginated at system boundaries ──
  const svgW = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
  const svgH = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 300;
  const scale = USABLE_W / svgW; // fit staves to page width
  const clone = printClone(svgEl);

  const firstMaxSvg = (PAGE_H - MARGIN - (MARGIN + TITLE_BLOCK_H)) / scale;
  const otherMaxSvg = (PAGE_H - 2 * MARGIN) / scale;
  const slices = sliceHeights(svgH, safeBreaks(svgEl, svgH), firstMaxSvg, otherMaxSvg);

  let svgTop = 0;
  for (let page = 0; page < slices.length; page++) {
    if (page > 0) doc.addPage();
    const yTop = page === 0 ? MARGIN + TITLE_BLOCK_H : MARGIN;
    const sliceH = slices[page] * scale;

    // Clip to this page's slice so neighbouring pages don't bleed in
    doc.saveGraphicsState();
    doc.rect(MARGIN, yTop, USABLE_W, sliceH, null);
    doc.clip();
    doc.discardPath();
    await svg2pdf(clone, doc, {
      x: MARGIN,
      y: yTop - svgTop * scale,
      width: USABLE_W,
      height: svgH * scale,
    });
    doc.restoreGraphicsState();
    svgTop += slices[page];
  }

  // ── Page numbers (only when multi-page) ──
  if (slices.length > 1) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    for (let page = 1; page <= slices.length; page++) {
      doc.setPage(page);
      doc.text(`${page} / ${slices.length}`, PAGE_W / 2, PAGE_H - 7, { align: 'center' });
    }
  }

  return doc;
}
