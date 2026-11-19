import { noBrandKit, noFiles } from '@tyto/core';
import { describe, expect, it } from 'vitest';

import { MARGIN, build } from './template.js';

import type {
  Frame,
  Inline,
  RichText,
  SceneNode,
  TemplateContext,
  TemplateReport,
  TextNode,
} from '@tyto/core';

/**
 * The first composition's rules, asserted on the scene: every text inside the page's margins,
 * the exam above the offer, both formats drawn, and an overflow reported when the words
 * outgrow the page.
 *
 * **Never a pixel size.** CI has no CircularXX, so the measure here is a stand-in with
 * proportional advances that wraps at spaces only, as Tyto's own layout does.
 */

/* ---------------------------------------------------------------------- the fixture -- */

let cursor = 0;

function rich(source: string): RichText {
  const parts: Inline[] = [];
  for (const [index, line] of source.split('\n').entries()) {
    if (index > 0) parts.push({ kind: 'break', range: { start: cursor, end: cursor++ } });
    const start = cursor;
    cursor += line.length;
    parts.push({ kind: 'text', value: line, range: { start, end: cursor } });
  }
  return parts;
}

/** A glyph's advance, in em. */
const ADVANCE = 0.55;

function sizeOf(node: Pick<TextNode, 'runs'>): number {
  return Math.max(...node.runs.map((r) => (r.kind === 'text' ? r.size : 0)));
}

/** The lines a text node comes out in, broken at plain spaces only. */
function layOut(node: Pick<TextNode, 'runs' | 'box' | 'letterSpacing'>): string[] {
  const size = sizeOf(node);
  const widthOf = (words: string) => [...words].length * (ADVANCE * size + node.letterSpacing);
  const paragraphs = node.runs
    .map((r) => (r.kind === 'text' ? r.text : '\n'))
    .join('')
    .split('\n');

  const result: string[] = [];
  for (const paragraph of paragraphs) {
    let line = '';
    for (const word of paragraph.split(' ').filter((piece) => piece !== '')) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (line !== '' && node.box.w !== undefined && widthOf(candidate) > node.box.w) {
        result.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    result.push(line);
  }
  return result;
}

const proportional: TemplateContext['measure'] = (node) => {
  const lines = layOut(node);
  const size = sizeOf(node);
  const width = Math.max(
    ...lines.map((line) => [...line].length * (ADVANCE * size + node.letterSpacing)),
  );
  return {
    runs: node.runs,
    lines: lines.length,
    width,
    height: lines.length * node.lineHeight * size,
    scale: 1,
    overflow: 0,
  };
};

const EXAM = [
  'Edital publicado',
  'Concurso QC Regula',
  'Analista Técnico',
  'Vagas: 40',
  'Salário: até R$ 9,2 mil',
  'Banca: Ômegas',
].join('\n');

const OFFER = ['Oferta: Lote Especial', 'Desconto: Pacotes com 40% OFF'].join('\n');

const FORMATS = { grid: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } } as const;

interface Built {
  readonly frame: Frame;
  readonly reports: TemplateReport[];
}

function render(
  brief: { concurso: string; versao: string },
  format: keyof typeof FORMATS = 'grid',
): Built {
  const reports: TemplateReport[] = [];
  const frame = build({
    format,
    size: FORMATS[format],
    idPrefix: `artwork-0-${format}`,
    artwork: { id: 'artwork-0', index: 0, count: 1 },
    slots: {
      concurso: {
        name: 'concurso',
        value: { kind: 'rich-text', text: rich(brief.concurso) },
        adjustments: [],
      },
      versao: {
        name: 'versao',
        value: { kind: 'rich-text', text: rich(brief.versao) },
        adjustments: [],
      },
    },
    adjustments: {},
    measure: proportional,
    report: (report) => reports.push(report),
    files: noFiles,
    brand: noBrandKit,
  });
  return { frame, reports };
}

/* ------------------------------------------------------------------ reading a scene -- */

interface PlacedText {
  readonly node: TextNode;
  readonly x: number;
  readonly y: number;
}

/** Every text node with its position in the frame. Only groups move their children here. */
function texts(frame: Frame): PlacedText[] {
  const result: PlacedText[] = [];
  const walk = (nodes: readonly SceneNode[], x: number, y: number) => {
    for (const node of nodes) {
      const nx = x + node.transform.x;
      const ny = y + node.transform.y;
      if (node.kind === 'text') result.push({ node, x: nx, y: ny });
      if (node.kind === 'group') walk(node.children, nx, ny);
    }
  };
  walk(frame.children, 0, 0);
  return result;
}

const wordsOf = (placed: PlacedText): string =>
  placed.node.runs.map((r) => (r.kind === 'text' ? r.text : '\n')).join('');

/* ------------------------------------------------------------------------- the rules -- */

describe.each(['grid', 'story'] as const)('the %s format', (format) => {
  const { frame, reports } = render({ concurso: EXAM, versao: OFFER }, format);
  const placed = texts(frame);

  it('draws a frame of the format’s size', () => {
    expect(frame.size).toEqual(FORMATS[format]);
  });

  it('draws the exam and the offer, the exam above', () => {
    const exam = placed.find((item) => wordsOf(item).includes('QC Regula'));
    const offer = placed.find((item) => wordsOf(item).includes('Lote Especial'));

    expect(exam).toBeDefined();
    expect(offer).toBeDefined();
    expect(exam!.y).toBeLessThan(offer!.y);
  });

  it('keeps every text inside the page’s margins, wrapping at spaces only', () => {
    for (const item of placed) {
      const lines = layOut(item.node);
      const width = Math.max(
        ...lines.map((line) => [...line].length * ADVANCE * sizeOf(item.node)),
      );
      expect(item.x).toBeGreaterThanOrEqual(MARGIN);
      expect(item.x + width).toBeLessThanOrEqual(FORMATS[format].w - MARGIN);
    }
  });

  it('reports no overflow for an exam and an offer of the reference’s length', () => {
    expect(reports.filter((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toEqual([]);
  });
});

describe('at the limits of its slots', () => {
  it('reports an overflow when the offer outgrows the page, rather than drawing past it', () => {
    const long = Array.from({ length: 40 }, (_, index) => `Item ${index + 1}: incluso`).join('\n');
    const { reports } = render({ concurso: EXAM, versao: long });

    expect(reports.some((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toBe(true);
  });

  it('draws an empty offer as no words, not as an error', () => {
    const { frame } = render({ concurso: EXAM, versao: '' });

    expect(texts(frame).some((item) => wordsOf(item).includes('QC Regula'))).toBe(true);
  });
});
