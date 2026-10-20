// Premium multi-page jsPDF builder for a handmade-feeling crochet pattern PDF.
// All text is drawn as vector so it stays razor-sharp at any zoom (300+ DPI print safe).
// Design language: soft cream paper, muted rose + gold + sage accents, elegant hierarchy,
// small "handmade" touches (kraft tag, stitched divider, hand-drawn corners).

import { jsPDF } from "jspdf";
import type { CrochetPattern } from "./types";

// A4 portrait, points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 60;                 // generous safe margin — prevents right-edge trimming
const RIGHT_PAD = 10;              // extra breathing room on the right of every text block
const CONTENT_W = PAGE_W - MARGIN * 2;
const TEXT_W = CONTENT_W - RIGHT_PAD;
const BOTTOM_SAFE = MARGIN + 40;   // reserve for footer

// Palette (RGB)
type RGB = readonly [number, number, number];
const C: Record<string, RGB> = {
  bg:         [252, 249, 244],   // warm cream paper
  paper:      [255, 253, 248],
  panel:      [250, 244, 236],
  ink:        [46, 40, 56],
  inkSoft:    [98, 88, 108],
  accent:     [176, 92, 108],    // muted rose
  accentSoft: [232, 210, 214],
  gold:       [196, 158, 96],
  sage:       [140, 160, 130],
  rule:       [220, 210, 200],
  chipBg:     [246, 236, 230],
  chipInk:    [120, 78, 68],
  kraft:      [214, 188, 148],   // handmade kraft tag
  stitch:     [180, 150, 130],
};

type Ctx = { pdf: jsPDF; y: number; page: number };

function newCtx(): Ctx {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  return { pdf, y: MARGIN, page: 1 };
}

/** Cream page background + soft side accent + subtle stitched border. */
function paintPageBg(pdf: jsPDF, opts: { chrome?: boolean } = {}) {
  pdf.setFillColor(...C.bg);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
  // left accent ribbon
  pdf.setFillColor(...C.accentSoft);
  pdf.rect(0, 0, 4, PAGE_H, "F");
  if (opts.chrome !== false) {
    // hand-drawn dashed border (stitched look)
    pdf.setDrawColor(...C.stitch);
    pdf.setLineWidth(0.4);
    pdf.setLineDashPattern([1.6, 2.4], 0);
    pdf.rect(MARGIN - 22, MARGIN - 22, PAGE_W - (MARGIN - 22) * 2, PAGE_H - (MARGIN - 22) * 2);
    pdf.setLineDashPattern([], 0);
  }
}

function newPage(ctx: Ctx) {
  ctx.pdf.addPage();
  ctx.page++;
  ctx.y = MARGIN + 10;
  paintPageBg(ctx.pdf);
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > PAGE_H - BOTTOM_SAFE) newPage(ctx);
}

function heading(ctx: Ctx, text: string) {
  ensureSpace(ctx, 50);
  ctx.y += 6;
  // decorative dot + sage stitch dash
  ctx.pdf.setFillColor(...C.accent);
  ctx.pdf.circle(MARGIN + 3, ctx.y - 6, 2.8, "F");
  ctx.pdf.setFont("times", "bold");
  ctx.pdf.setFontSize(20);
  ctx.pdf.setTextColor(...C.ink);
  const lines = ctx.pdf.splitTextToSize(text, TEXT_W - 20) as string[];
  ctx.pdf.text(lines[0] ?? text, MARGIN + 16, ctx.y);
  ctx.y += 8;
  ctx.pdf.setDrawColor(...C.gold);
  ctx.pdf.setLineWidth(0.8);
  ctx.pdf.line(MARGIN + 16, ctx.y, MARGIN + 78, ctx.y);
  ctx.y += 16;
}

function subHeading(ctx: Ctx, text: string) {
  ensureSpace(ctx, 24);
  const upper = text.toUpperCase();
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(10.5);
  ctx.pdf.setTextColor(...C.accent);
  ctx.pdf.text(upper, MARGIN, ctx.y);
  const tw = ctx.pdf.getTextWidth(upper);
  ctx.pdf.setDrawColor(...C.accentSoft);
  ctx.pdf.setLineWidth(0.5);
  const lineStart = MARGIN + tw + 10;
  const lineEnd = PAGE_W - MARGIN;
  if (lineEnd > lineStart) ctx.pdf.line(lineStart, ctx.y - 3, lineEnd, ctx.y - 3);
  ctx.y += 15;
}

function paragraph(ctx: Ctx, text: string, size = 10.5, indent = 0, color = C.ink) {
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(size);
  ctx.pdf.setTextColor(...color);
  const lines = ctx.pdf.splitTextToSize(text, TEXT_W - indent) as string[];
  for (const line of lines) {
    ensureSpace(ctx, size + 4);
    ctx.pdf.text(line, MARGIN + indent, ctx.y);
    ctx.y += size + 3.5;
  }
}

function bulletList(ctx: Ctx, items: string[], size = 10.5) {
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(size);
  for (const it of items) {
    const lines = ctx.pdf.splitTextToSize(it, TEXT_W - 22) as string[];
    ensureSpace(ctx, lines.length * (size + 3) + 4);
    ctx.pdf.setFillColor(...C.accent);
    ctx.pdf.circle(MARGIN + 3, ctx.y - 3, 1.8, "F");
    ctx.pdf.setTextColor(...C.ink);
    for (let i = 0; i < lines.length; i++) {
      ctx.pdf.text(lines[i], MARGIN + 14, ctx.y);
      ctx.y += size + 3;
    }
    ctx.y += 1;
  }
  ctx.y += 4;
}

function numberedSteps(ctx: Ctx, items: string[], size = 10.5) {
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(size);
  items.forEach((it, i) => {
    const lines = ctx.pdf.splitTextToSize(it, TEXT_W - 30) as string[];
    ensureSpace(ctx, lines.length * (size + 3) + 6);
    // number badge
    ctx.pdf.setFillColor(...C.accentSoft);
    ctx.pdf.circle(MARGIN + 8, ctx.y - 3, 8.5, "F");
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...C.accent);
    ctx.pdf.text(String(i + 1), MARGIN + 8, ctx.y - 1, { align: "center" });
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(size);
    ctx.pdf.setTextColor(...C.ink);
    for (let j = 0; j < lines.length; j++) {
      ctx.pdf.text(lines[j], MARGIN + 24, ctx.y);
      ctx.y += size + 3;
    }
    ctx.y += 4;
  });
  ctx.y += 4;
}

function twoColList(ctx: Ctx, rows: { l: string; r: string }[]) {
  const size = 10;
  const gap = 20;
  const colW = (CONTENT_W - gap) / 2;
  const rowH = size + 8;
  for (let i = 0; i < rows.length; i += 2) {
    ensureSpace(ctx, rowH);
    // zebra
    if ((i / 2) % 2 === 0) {
      ctx.pdf.setFillColor(...C.panel);
      ctx.pdf.rect(MARGIN - 4, ctx.y - size, CONTENT_W + 8, rowH, "F");
    }
    const draw = (row: { l: string; r: string }, x: number, w: number) => {
      ctx.pdf.setFont("helvetica", "bold");
      ctx.pdf.setFontSize(size);
      ctx.pdf.setTextColor(...C.accent);
      ctx.pdf.text(row.l, x, ctx.y);
      ctx.pdf.setFont("helvetica", "normal");
      ctx.pdf.setTextColor(...C.ink);
      const rLines = ctx.pdf.splitTextToSize(row.r, w - 56) as string[];
      ctx.pdf.text(rLines[0] ?? "", x + 52, ctx.y);
    };
    draw(rows[i], MARGIN, colW);
    if (rows[i + 1]) draw(rows[i + 1], MARGIN + colW + gap, colW);
    ctx.y += rowH;
  }
  ctx.y += 6;
}

/** Info card block (used for gauge, finished size, skill). */
function statCards(ctx: Ctx, cards: { label: string; value: string }[]) {
  if (!cards.length) return;
  const gap = 10;
  const cardW = (CONTENT_W - (cards.length - 1) * gap) / cards.length;
  const h = 52;
  ensureSpace(ctx, h + 10);
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap);
    ctx.pdf.setFillColor(...C.paper);
    ctx.pdf.setDrawColor(...C.accentSoft);
    ctx.pdf.setLineWidth(0.7);
    ctx.pdf.roundedRect(x, ctx.y, cardW, h, 8, 8, "FD");
    // tiny gold corner
    ctx.pdf.setFillColor(...C.gold);
    ctx.pdf.circle(x + cardW - 8, ctx.y + 8, 1.6, "F");
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(7.6);
    ctx.pdf.setTextColor(...C.accent);
    ctx.pdf.text(c.label.toUpperCase(), x + 12, ctx.y + 16);
    ctx.pdf.setFont("times", "bold");
    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...C.ink);
    const val = ctx.pdf.splitTextToSize(c.value, cardW - 24) as string[];
    ctx.pdf.text(val[0] ?? "", x + 12, ctx.y + 34);
    if (val[1]) {
      ctx.pdf.setFontSize(9.5);
      ctx.pdf.text(val[1], x + 12, ctx.y + 46);
    }
  });
  ctx.y += h + 14;
}

/** Vector stitch-chart rounds. */
function drawChart(ctx: Ctx, rounds: { label: string; symbols: string[] }[]) {
  const cellW = 26, cellH = 22, gap = 4;
  const colors: Record<string, [number, number, number]> = {
    ch:   [240, 235, 230],
    sc:   [252, 224, 208],
    hdc:  [248, 200, 172],
    dc:   [240, 170, 138],
    tr:   [220, 138, 108],
    inc:  [206, 226, 200],
    dec:  [238, 200, 202],
    slst: [216, 216, 236],
    sl:   [216, 216, 236],
    mr:   [246, 232, 190],
  };
  for (const r of rounds) {
    ensureSpace(ctx, cellH + 8);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(9.5);
    ctx.pdf.setTextColor(...C.accent);
    ctx.pdf.text(r.label, MARGIN, ctx.y + cellH * 0.65);
    let x = MARGIN + 36;
    for (const s of r.symbols) {
      if (x + cellW > PAGE_W - MARGIN) {
        ctx.y += cellH + gap;
        ensureSpace(ctx, cellH + 4);
        x = MARGIN + 36;
      }
      const key = s.toLowerCase().replace(/\s+/g, "");
      const rgb = colors[key] ?? [235, 235, 235];
      ctx.pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      ctx.pdf.setDrawColor(150, 130, 130);
      ctx.pdf.setLineWidth(0.4);
      ctx.pdf.roundedRect(x, ctx.y, cellW, cellH, 3, 3, "FD");
      ctx.pdf.setFont("helvetica", "bold");
      ctx.pdf.setFontSize(8);
      ctx.pdf.setTextColor(50, 40, 50);
      ctx.pdf.text(s, x + cellW / 2, ctx.y + cellH * 0.65, { align: "center" });
      x += cellW + gap;
    }
    ctx.y += cellH + gap + 4;
  }
  ctx.y += 6;
}

/** Detect PNG vs JPEG from the first bytes of a base64 payload. */
function detectImageFormat(b64: string): "PNG" | "JPEG" {
  const head = b64.slice(0, 16);
  // JPEG starts with /9j/
  if (head.startsWith("/9j/")) return "JPEG";
  return "PNG";
}

/** Elegant handmade-feeling cover page. */
function coverPage(ctx: Ctx, pattern: CrochetPattern, heroB64: string | null, shopName?: string) {
  const p = ctx.pdf;
  paintPageBg(p, { chrome: false });

  // Top ornamental bands
  p.setFillColor(...C.accentSoft);
  p.rect(0, 0, PAGE_W, 8, "F");
  p.setFillColor(...C.gold);
  p.rect(0, 8, PAGE_W, 1.4, "F");

  // Kraft "handmade" tag — top-right, tied with string
  const tagW = 90, tagH = 34, tagX = PAGE_W - MARGIN - tagW, tagY = 30;
  p.setFillColor(...C.kraft);
  p.roundedRect(tagX, tagY, tagW, tagH, 4, 4, "F");
  p.setDrawColor(...C.chipInk);
  p.setLineWidth(0.6);
  p.circle(tagX + 10, tagY + tagH / 2, 3, "D");
  p.line(tagX + 12, tagY + tagH / 2, tagX - 6, tagY - 4);
  p.setFont("times", "italic");
  p.setFontSize(9);
  p.setTextColor(...C.chipInk);
  p.text("· handmade ·", tagX + tagW / 2 + 4, tagY + 14, { align: "center" });
  p.setFont("helvetica", "bold");
  p.setFontSize(8);
  p.text("CROCHET  PATTERN", tagX + tagW / 2 + 4, tagY + 25, { align: "center" });

  // Hero image
  const imgY = 96;
  const imgH = 360;
  const imgW = CONTENT_W;
  if (heroB64) {
    try {
      // Soft frame shadow
      p.setFillColor(...C.accentSoft);
      p.roundedRect(MARGIN - 4, imgY - 4, imgW + 8, imgH + 8, 14, 14, "F");
      const fmt = detectImageFormat(heroB64);
      p.addImage(`data:image/${fmt.toLowerCase()};base64,${heroB64}`, fmt, MARGIN, imgY, imgW, imgH, undefined, "SLOW");
      // hand-drawn corner ticks
      p.setDrawColor(...C.gold);
      p.setLineWidth(1);
      const corner = 14;
      const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
        p.line(cx, cy, cx + dx * corner, cy);
        p.line(cx, cy, cx, cy + dy * corner);
      };
      drawCorner(MARGIN - 6, imgY - 6, 1, 1);
      drawCorner(MARGIN + imgW + 6, imgY - 6, -1, 1);
      drawCorner(MARGIN - 6, imgY + imgH + 6, 1, -1);
      drawCorner(MARGIN + imgW + 6, imgY + imgH + 6, -1, -1);
    } catch { /* ignore */ }
  } else {
    p.setFillColor(...C.paper);
    p.roundedRect(MARGIN, imgY, imgW, imgH, 12, 12, "F");
    p.setFont("times", "italic");
    p.setFontSize(16);
    p.setTextColor(...C.inkSoft);
    p.text("Crochet Pattern", PAGE_W / 2, imgY + imgH / 2, { align: "center" });
  }

  // Ornamental flourish
  const flourY = imgY + imgH + 40;
  p.setDrawColor(...C.gold);
  p.setLineWidth(0.7);
  p.line(PAGE_W / 2 - 70, flourY, PAGE_W / 2 - 14, flourY);
  p.line(PAGE_W / 2 + 14, flourY, PAGE_W / 2 + 70, flourY);
  p.setFillColor(...C.gold);
  p.circle(PAGE_W / 2, flourY, 2.6, "F");
  p.circle(PAGE_W / 2 - 12, flourY, 1.1, "F");
  p.circle(PAGE_W / 2 + 12, flourY, 1.1, "F");

  // Title — large italic serif, safely wrapped
  p.setFont("times", "italic");
  p.setFontSize(32);
  p.setTextColor(...C.ink);
  const titleLines = p.splitTextToSize(pattern.title || "Crochet Pattern", CONTENT_W - 40) as string[];
  let ty = flourY + 38;
  for (const l of titleLines.slice(0, 2)) { p.text(l, PAGE_W / 2, ty, { align: "center" }); ty += 32; }

  // Sub-caption
  p.setFont("helvetica", "bold");
  p.setFontSize(10.5);
  p.setTextColor(...C.accent);
  p.text("C R O C H E T   G U I D E", PAGE_W / 2, ty + 6, { align: "center" });

  // Signature ribbon
  const ribY = PAGE_H - 96;
  const ribW = CONTENT_W - 40;
  p.setFillColor(...C.paper);
  p.setDrawColor(...C.accentSoft);
  p.setLineWidth(0.9);
  p.roundedRect((PAGE_W - ribW) / 2, ribY, ribW, 44, 22, 22, "FD");
  p.setFont("helvetica", "bold");
  p.setFontSize(9.5);
  p.setTextColor(...C.chipInk);
  p.text("BEAUTIFUL  ·  PRACTICAL  ·  HANDMADE", PAGE_W / 2, ribY + 18, { align: "center" });
  p.setFont("times", "italic");
  p.setFontSize(11);
  p.setTextColor(...C.accent);
  p.text("Made with Love  \u2665", PAGE_W / 2, ribY + 33, { align: "center" });

  // Shop line
  p.setFont("times", "italic");
  p.setFontSize(9);
  p.setTextColor(...C.inkSoft);
  p.text(shopName ? `An original design by ${shopName}` : "An original handmade crochet design", PAGE_W / 2, PAGE_H - 34, { align: "center" });

  newPage(ctx);
}

function pageChrome(ctx: Ctx, pattern: CrochetPattern) {
  const total = ctx.pdf.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    ctx.pdf.setPage(i);
    // running header
    ctx.pdf.setFont("times", "italic");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...C.inkSoft);
    const shortTitle = (pattern.title || "Crochet Pattern").slice(0, 70);
    ctx.pdf.text(shortTitle, MARGIN, 32);
    ctx.pdf.setDrawColor(...C.rule);
    ctx.pdf.setLineWidth(0.4);
    ctx.pdf.line(MARGIN, 38, PAGE_W - MARGIN, 38);
    // footer
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(...C.inkSoft);
    ctx.pdf.text(`Page ${i} of ${total}`, PAGE_W / 2, PAGE_H - 24, { align: "center" });
    // small handmade heart in footer corner
    ctx.pdf.setTextColor(...C.accent);
    ctx.pdf.setFont("times", "italic");
    ctx.pdf.setFontSize(9);
    ctx.pdf.text("\u2665  handmade", PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }
}

export async function buildCrochetPdf(
  pattern: CrochetPattern,
  heroImageB64: string | null,
  shopName?: string,
): Promise<Blob> {
  const ctx = newCtx();
  paintPageBg(ctx.pdf, { chrome: false });

  // ---- Cover
  coverPage(ctx, pattern, heroImageB64, shopName);

  // ---- At-a-Glance
  heading(ctx, "At a Glance");
  if (pattern.subtitle) paragraph(ctx, pattern.subtitle, 11, 0, C.inkSoft);
  ctx.y += 4;
  statCards(ctx, [
    { label: "Skill Level",   value: pattern.skillLevel || "\u2014" },
    { label: "Finished Size", value: pattern.finishedSize || "\u2014" },
    { label: "Terms",         value: `${pattern.terminology} crochet` },
    { label: "Gauge",         value: pattern.gauge || "\u2014" },
  ]);

  // ---- Materials
  heading(ctx, "Materials & Tools");
  if (pattern.materials?.yarn?.length)    { subHeading(ctx, "Yarn"); bulletList(ctx, pattern.materials.yarn); }
  if (pattern.materials?.hooks?.length)   { subHeading(ctx, "Hooks"); bulletList(ctx, pattern.materials.hooks); }
  if (pattern.materials?.notions?.length) { subHeading(ctx, "Notions"); bulletList(ctx, pattern.materials.notions); }

  // ---- Abbreviations
  heading(ctx, `Abbreviations \u00b7 ${pattern.terminology} Terms`);
  twoColList(ctx, (pattern.abbreviations ?? []).map((a) => ({ l: a.key, r: a.meaning })));

  if (pattern.specialStitches?.length) {
    heading(ctx, "Special Stitches");
    for (const s of pattern.specialStitches) {
      subHeading(ctx, s.name);
      paragraph(ctx, s.how);
      ctx.y += 4;
    }
  }

  // ---- Pattern
  heading(ctx, "The Pattern");
  for (const sec of pattern.sections ?? []) {
    subHeading(ctx, sec.name);
    for (let i = 0; i < (sec.rows?.length ?? 0); i++) {
      const r = sec.rows[i];
      const lines = ctx.pdf.splitTextToSize(r, TEXT_W - 20) as string[];
      const rowHeight = lines.length * 13 + 4;
      ensureSpace(ctx, rowHeight);
      if (i % 2 === 0) {
        ctx.pdf.setFillColor(...C.panel);
        ctx.pdf.rect(MARGIN - 6, ctx.y - 10, CONTENT_W + 12, rowHeight, "F");
      }
      ctx.pdf.setFont("courier", "normal");
      ctx.pdf.setFontSize(10);
      ctx.pdf.setTextColor(...C.ink);
      for (const line of lines) {
        ctx.pdf.text(line, MARGIN, ctx.y);
        ctx.y += 13;
      }
    }
    if (sec.notes?.length) {
      ctx.y += 4;
      const noteText = sec.notes.map((n) => `\u2022 ${n}`).join("\n");
      ctx.pdf.setFont("helvetica", "italic");
      ctx.pdf.setFontSize(9.5);
      const wrapped = ctx.pdf.splitTextToSize(noteText, CONTENT_W - 24) as string[];
      const boxH = wrapped.length * 12 + 14;
      ensureSpace(ctx, boxH);
      ctx.pdf.setFillColor(...C.chipBg);
      ctx.pdf.setDrawColor(...C.accentSoft);
      ctx.pdf.setLineWidth(0.6);
      ctx.pdf.roundedRect(MARGIN, ctx.y, CONTENT_W, boxH, 6, 6, "FD");
      ctx.pdf.setTextColor(...C.chipInk);
      let ny = ctx.y + 15;
      for (const l of wrapped) { ctx.pdf.text(l, MARGIN + 12, ny); ny += 12; }
      ctx.y += boxH + 8;
    }
    ctx.y += 10;
  }

  // ---- Stitch chart
  if (pattern.chartRounds?.length) {
    heading(ctx, "Stitch Chart");
    paragraph(ctx, "Round-by-round visual guide. Colors group stitch families for easy reading. Vector-drawn \u2014 infinitely sharp at any zoom.", 10, 0, C.inkSoft);
    ctx.y += 4;
    drawChart(ctx, pattern.chartRounds);
  }

  // ---- Assembly & Care
  if (pattern.assembly?.length) { heading(ctx, "Finishing & Assembly"); numberedSteps(ctx, pattern.assembly); }
  if (pattern.care?.length)     { heading(ctx, "Care Instructions"); bulletList(ctx, pattern.care); }

  // ---- License
  heading(ctx, "License");
  const licenseText = pattern.copyright || "\u00a9 All rights reserved. For personal, non-commercial use only. Do not resell, redistribute, or share the pattern file. Finished items may be sold in small quantities crediting the designer.";
  ctx.pdf.setFont("helvetica", "italic");
  ctx.pdf.setFontSize(10);
  const wrapped = ctx.pdf.splitTextToSize(licenseText, CONTENT_W - 24) as string[];
  const bh = wrapped.length * 13 + 22;
  ensureSpace(ctx, bh + 30);
  ctx.pdf.setFillColor(...C.paper);
  ctx.pdf.setDrawColor(...C.accentSoft);
  ctx.pdf.setLineWidth(0.6);
  ctx.pdf.roundedRect(MARGIN, ctx.y, CONTENT_W, bh, 8, 8, "FD");
  ctx.pdf.setTextColor(...C.inkSoft);
  let ly = ctx.y + 17;
  for (const l of wrapped) { ctx.pdf.text(l, MARGIN + 12, ly); ly += 13; }
  ctx.y += bh + 12;
  if (shopName) {
    ctx.pdf.setFont("times", "italic");
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...C.accent);
    ctx.pdf.text(`Thank you for supporting ${shopName} \u2014 happy crocheting! \u2665`, PAGE_W / 2, ctx.y + 6, { align: "center" });
  }

  pageChrome(ctx, pattern);
  return ctx.pdf.output("blob");
}

export function patternHash(p: Pick<CrochetPattern, "title" | "sections">): string {
  const t = (p.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  const r = (p.sections?.[0]?.rows?.[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
  let h = 0;
  const s = `${t}::${r}`;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return `h${(h >>> 0).toString(36)}`;
}
