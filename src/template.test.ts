import { noBrandKit, noFiles } from '@tyto/core';
import { describe, expect, it } from 'vitest';

import { TEXT_MARGIN as MARGIN, build } from './template.js';

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
 * The composition's rules, asserted on the scene: every text inside the page's margins, the
 * head ranked by the brief's levels, the card shaped by the `apelo`'s parts, and an overflow
 * reported when the words outgrow the page.
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

const HEAD = [
  '## Edital publicado | # Concurso QC Regula',
  'Vagas para Analista Técnico',
  '## Ganhe até R$ 9,2 mil',
].join('\n');

const OFFER = 'Lote Especial | # Pacotes com 40% OFF | Por tempo limitado';

const FORMATS = { grid: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } } as const;

interface Built {
  readonly frame: Frame;
  readonly reports: TemplateReport[];
}

function slot(name: string, source: string) {
  return { name, value: { kind: 'rich-text' as const, text: rich(source) }, adjustments: [] };
}

function render(
  brief: { titulo: string; apelo?: string; nota?: string },
  format: keyof typeof FORMATS = 'grid',
): Built {
  const reports: TemplateReport[] = [];
  const frame = build({
    format,
    size: FORMATS[format],
    idPrefix: `lamina-0-${format}`,
    artwork: { id: 'lamina-0', index: 0, count: 1 },
    slots: {
      titulo: slot('titulo', brief.titulo),
      lamina: slot('lamina', ''),
      ...(brief.apelo === undefined ? {} : { apelo: slot('apelo', brief.apelo) }),
      ...(brief.nota === undefined ? {} : { nota: slot('nota', brief.nota) }),
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

const find = (frame: Frame, words: string): PlacedText | undefined =>
  texts(frame).find((item) => wordsOf(item).includes(words));

/** Where a placed text ends, by the stand-in measure. */
const bottomOf = (placed: PlacedText): number =>
  placed.y + layOut(placed.node).length * placed.node.lineHeight * sizeOf(placed.node);

interface PlacedRect {
  readonly y: number;
  readonly h: number;
  readonly radius: unknown;
}

/** A rectangle by name, with its position in the frame, or nothing. */
function rectNamed(frame: Frame, name: string): PlacedRect | undefined {
  let found: PlacedRect | undefined;
  const walk = (nodes: readonly SceneNode[], y: number) => {
    for (const node of nodes) {
      const ny = y + node.transform.y;
      if (node.kind === 'rect' && node.name === name) {
        found = { y: ny, h: node.size.h, radius: node.radius };
      }
      if (node.kind === 'group') walk(node.children, ny);
    }
  };
  walk(frame.children, 0);
  return found;
}

/* ------------------------------------------------------------------------- the rules -- */

describe.each(['grid', 'story'] as const)('the %s format', (format) => {
  const { frame, reports } = render(
    { titulo: HEAD, apelo: OFFER, nota: 'Estude **como**' },
    format,
  );
  const placed = texts(frame);

  it('draws a frame of the format’s size', () => {
    expect(frame.size).toEqual(FORMATS[format]);
  });

  it('draws the # part in capitals, the ## status above it, the offer below', () => {
    const status = find(frame, 'Edital publicado');
    const exam = find(frame, 'QC REGULA');
    const offer = find(frame, 'Lote Especial');

    expect(status).toBeDefined();
    expect(exam).toBeDefined();
    expect(offer).toBeDefined();
    expect(status!.y).toBeLessThan(exam!.y);
    expect(exam!.y).toBeLessThan(offer!.y);
  });

  it('draws a later unmarked line smaller than the # part', () => {
    expect(sizeOf(find(frame, 'Vagas para')!.node)).toBeLessThan(
      sizeOf(find(frame, 'QC REGULA')!.node),
    );
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

  it('reports no overflow for a head and an offer of the reference’s length', () => {
    expect(reports.filter((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toEqual([]);
  });
});

describe('the card takes the shape of the apelo’s parts', () => {
  const R = 39;

  it('puts the band on top with the top corners when there is no title', () => {
    const { frame } = render({ titulo: HEAD, apelo: 'Pacotes com 40% OFF | Por tempo limitado' });
    const card = rectNamed(frame, 'cartao')!;
    const band = rectNamed(frame, 'faixa')!;

    expect(card.y).toBe(band.y);
    expect(band.radius).toEqual([R, R, 0, 0]);
    expect(find(frame, 'Por tempo')!.y).toBeGreaterThan(band.y + band.h);
  });

  it('puts the band at the bottom with the bottom corners when there is no foot', () => {
    const { frame } = render({ titulo: HEAD, apelo: 'Lote Especial | # Pacotes com 40% OFF' });
    const card = rectNamed(frame, 'cartao')!;
    const band = rectNamed(frame, 'faixa')!;

    expect(card.y + card.h).toBe(band.y + band.h);
    expect(band.radius).toEqual([0, 0, R, R]);
    expect(find(frame, 'Lote Especial')!.y).toBeLessThan(band.y);
  });

  it('puts the band in the middle with square corners between a title and a foot', () => {
    const { frame } = render({ titulo: HEAD, apelo: OFFER });
    const card = rectNamed(frame, 'cartao')!;
    const band = rectNamed(frame, 'faixa')!;

    expect(card.y).toBeLessThan(band.y);
    expect(card.y + card.h).toBeGreaterThan(band.y + band.h);
    expect(band.radius).toEqual([0, 0, 0, 0]);
  });

  it('draws no card when there is no apelo, and no error', () => {
    const { frame } = render({ titulo: HEAD });
    expect(rectNamed(frame, 'cartao')).toBeUndefined();
    expect(find(frame, 'QC REGULA')).toBeDefined();
  });

  it('shrinks a long band line to fit the card rather than wrapping it', () => {
    const { frame } = render({
      titulo: HEAD,
      apelo: 'Lote | # Todos os pacotes com 40% OFF | Prazo',
    });
    expect(layOut(find(frame, 'Todos os pacotes')!.node)).toHaveLength(1);
  });

  it('grows the card upward when its title wraps, keeping the band in its place', () => {
    const title = 'Pacote completo com teoria, questões e fórum '.repeat(3);
    const plainCard = rectNamed(render({ titulo: HEAD, apelo: OFFER }).frame, 'cartao')!;
    const plainBand = rectNamed(render({ titulo: HEAD, apelo: OFFER }).frame, 'faixa')!;
    const { frame, reports } = render({ titulo: HEAD, apelo: `${title} | # Pacotes com 40% OFF` });
    const card = rectNamed(frame, 'cartao')!;
    const band = rectNamed(frame, 'faixa')!;
    const drawn = find(frame, 'Pacote completo')!;

    expect(card.y).toBeLessThan(plainCard.y);
    expect(band.y).toBe(plainBand.y);
    expect(drawn.y).toBeGreaterThanOrEqual(card.y);
    expect(bottomOf(drawn)).toBeLessThanOrEqual(band.y);
    expect(reports.filter((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toEqual([]);
  });
});

describe('the head at the limits of its slot', () => {
  it('pushes every head line below one that wrapped, so no two overlap', () => {
    const status = 'Edital publicado com vagas na área ambiental e cadastro de reserva';
    const { frame } = render({ titulo: HEAD.replace('Edital publicado', status), apelo: OFFER });
    const head = ['Edital publicado com', 'QC REGULA', 'Vagas para', 'R$ 9,2 mil'].map((words) =>
      find(frame, words)!,
    );

    expect(layOut(head[0]!.node).length).toBeGreaterThan(1);
    for (let index = 1; index < head.length; index++) {
      expect(head[index]!.y).toBeGreaterThanOrEqual(bottomOf(head[index - 1]!));
    }
  });

  it('raises the panel over the photograph to make room for the head', () => {
    const name = 'Concurso Prefeitura Municipal de Lagoa Santa do Norte Mineiro';
    const plain = rectNamed(render({ titulo: HEAD, apelo: OFFER }).frame, 'painel')!;
    const { frame } = render({
      titulo: HEAD.replace('Concurso QC Regula', name),
      apelo: OFFER,
    });

    expect(rectNamed(frame, 'painel')!.y).toBeLessThan(plain.y);
  });

  it('reports an overflow when the supporting lines grow into the card', () => {
    const support = Array.from({ length: 8 }, (_, index) => `Cargo de apoio ${index + 1}`);
    const { reports } = render({ titulo: [HEAD, ...support].join('\n'), apelo: OFFER });

    expect(reports.some((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toBe(true);
  });

  it('draws the divider between two lines, and a note under the card', () => {
    const { frame } = render({
      titulo: `# Concurso QC Regula\n---\n## Ganhe até R$ 9,2 mil`,
      apelo: OFFER,
      nota: 'Estude como 7 a cada 10',
    });
    const dot = rectNamed(frame, 'ponto')!;

    expect(dot.y).toBeGreaterThan(find(frame, 'QC REGULA')!.y);
    expect(dot.y).toBeLessThan(find(frame, 'R$ 9,2 mil')!.y);
    expect(find(frame, 'Estude como')!.y).toBeGreaterThan(find(frame, 'Por tempo')!.y);
  });
});
