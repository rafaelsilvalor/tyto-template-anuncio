import { noBrandKit, noFiles } from '@tyto/core';
import { describe, expect, it } from 'vitest';

import { GRID, STORY, TEXT_MARGIN as MARGIN, build } from './template.js';

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

function slot(name: string, source: string, peso?: string) {
  return {
    name,
    value: { kind: 'rich-text' as const, text: rich(source) },
    adjustments:
      peso === undefined ? [] : [{ name: 'peso', value: peso, range: { start: 0, end: 0 } }],
  };
}

type BlockName = 'titulo' | 'apelo' | 'nota';

interface Brief {
  readonly titulo: string;
  readonly apelo?: string;
  readonly nota?: string;
  /** The brief's order, as `context.order` carries it (Tyto ADR 0225). */
  readonly order?: readonly BlockName[];
  readonly peso?: Partial<Record<BlockName, '1' | '2' | '3' | undefined>>;
}

function render(brief: Brief, format: keyof typeof FORMATS = 'grid'): Built {
  const reports: TemplateReport[] = [];
  const frame = build({
    format,
    size: FORMATS[format],
    idPrefix: `lamina-0-${format}`,
    artwork: { id: 'lamina-0', index: 0, count: 1 },
    slots: {
      titulo: slot('titulo', brief.titulo, brief.peso?.titulo),
      lamina: slot('lamina', ''),
      ...(brief.apelo === undefined
        ? {}
        : { apelo: slot('apelo', brief.apelo, brief.peso?.apelo) }),
      ...(brief.nota === undefined ? {} : { nota: slot('nota', brief.nota, brief.peso?.nota) }),
    },
    ...(brief.order === undefined
      ? {}
      : { order: brief.order.map((name) => ({ name, place: 'own' as const })) }),
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

  it('grows the card when its title wraps, the title kept inside it above the band', () => {
    const title = 'Pacote completo com teoria, questões e fórum '.repeat(3);
    const plainCard = rectNamed(render({ titulo: HEAD, apelo: OFFER }).frame, 'cartao')!;
    const { frame, reports } = render({ titulo: HEAD, apelo: `${title} | # Pacotes com 40% OFF` });
    const card = rectNamed(frame, 'cartao')!;
    const band = rectNamed(frame, 'faixa')!;
    const drawn = find(frame, 'Pacote completo')!;

    expect(card.h).toBeGreaterThan(plainCard.h);
    expect(drawn.y).toBeGreaterThan(card.y);
    expect(bottomOf(drawn)).toBeLessThanOrEqual(band.y);
    expect(reports.filter((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toEqual([]);
  });
});

describe.each(['grid', 'story'] as const)('a band whose words wrap, in the %s format', (format) => {
  const apelo = 'Comece antes do edital | # Prepare-se com quem aprova mais gente em todo o país';
  const plain = render({ titulo: HEAD, apelo: OFFER }, format).frame;
  const { frame, reports } = render({ titulo: HEAD, apelo }, format);
  const band = rectNamed(frame, 'faixa')!;
  const plainBand = rectNamed(plain, 'faixa')!;
  const words = find(frame, 'Prepare-se')!;

  it('wraps the band’s words at the shrink floor', () => {
    expect(layOut(words.node).length).toBeGreaterThan(1);
  });

  it('keeps the band at least the reference’s height, holding both lines', () => {
    expect(band.h).toBeGreaterThanOrEqual(plainBand.h);
    expect(bottomOf(words) - words.y).toBeGreaterThan(sizeOf(words.node));
  });

  it('keeps every band word inside the band, and the title above it', () => {
    expect(words.y).toBeGreaterThanOrEqual(band.y);
    expect(bottomOf(words)).toBeLessThanOrEqual(band.y + band.h);
    expect(bottomOf(find(frame, 'Comece antes')!)).toBeLessThanOrEqual(band.y);
  });

  it('reports no overflow', () => {
    expect(reports.filter((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toEqual([]);
  });
});

describe.each([
  ['grid', GRID],
  ['story', STORY],
] as const)('the head’s room per pair of lines, in the %s format', (format, geometry) => {
  const { frame } = render({ titulo: HEAD, apelo: OFFER }, format);
  const name = find(frame, 'QC REGULA')!;
  const support = find(frame, 'Vagas para')!;
  const salary = find(frame, 'R$ 9,2 mil')!;

  // The gaps follow the head's scale, read off the name's size against the reference's.
  const ratio = sizeOf(name.node) / geometry.name.size;

  it('leaves the name’s own room under the # line', () => {
    expect(support.y - bottomOf(name)).toBeCloseTo(geometry.nameGap * ratio, 5);
  });

  it('leaves the smaller room between the supporting line and the salary', () => {
    expect(salary.y - bottomOf(support)).toBeCloseTo(geometry.lineGap * ratio, 5);
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

  it('shrinks every block before it raises the panel, and keeps a quarter for the photograph', () => {
    const support = Array.from({ length: 14 }, (_, index) => `Cargo de apoio ${index + 1}`);
    const plain = render({ titulo: HEAD, apelo: OFFER }).frame;
    const { frame, reports } = render({ titulo: [HEAD, ...support].join('\n'), apelo: OFFER });
    const panel = rectNamed(frame, 'painel')!;

    expect(panel.y).toBeLessThan(rectNamed(plain, 'painel')!.y);
    expect(panel.y).toBeGreaterThanOrEqual(FORMATS.grid.h * 0.25);
    expect(sizeOf(find(frame, 'Pacotes com')!.node)).toBeLessThan(
      sizeOf(find(plain, 'Pacotes com')!.node),
    );
    expect(reports.filter((report) => report.code === 'W_TEMPLATE_OVERFLOW')).toEqual([]);
  });

  it('reports an overflow when the floor and the photograph’s quarter leave no room', () => {
    const support = Array.from({ length: 30 }, (_, index) => `Cargo de apoio ${index + 1}`);
    const { frame, reports } = render({ titulo: [HEAD, ...support].join('\n'), apelo: OFFER });

    expect(rectNamed(frame, 'painel')!.y).toBeCloseTo(FORMATS.grid.h * 0.25, 5);
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

describe('the blocks as the brief wrote them', () => {
  it('draws the note above the card when the brief wrote it first', () => {
    const { frame } = render({
      titulo: HEAD,
      apelo: OFFER,
      nota: 'Estude como 7 a cada 10',
      order: ['titulo', 'nota', 'apelo'],
    });
    expect(find(frame, 'Estude como')!.y).toBeLessThan(rectNamed(frame, 'cartao')!.y);
  });

  it('draws the note below the card when the brief wrote it last', () => {
    const { frame } = render({
      titulo: HEAD,
      apelo: OFFER,
      nota: 'Estude como 7 a cada 10',
      order: ['titulo', 'apelo', 'nota'],
    });
    const card = rectNamed(frame, 'cartao')!;
    expect(find(frame, 'Estude como')!.y).toBeGreaterThan(card.y + card.h);
  });

  it('keeps the head’s gap between the head and the card, whatever room is left', () => {
    const { frame } = render({ titulo: HEAD, apelo: OFFER });
    const card = rectNamed(frame, 'cartao')!;
    expect(card.y - bottomOf(find(frame, 'R$ 9,2 mil')!)).toBeCloseTo(56, 5);
  });

  it('draws a block written {peso: 1} smaller and {peso: 3} larger', () => {
    const size = (peso?: '1' | '3') =>
      sizeOf(
        find(render({ titulo: HEAD, apelo: OFFER, peso: { apelo: peso } }).frame, 'Por tempo')!
          .node,
      );
    expect(size('1')).toBeLessThan(size());
    expect(size('3')).toBeGreaterThan(size());
  });
});

describe('the main line', () => {
  it('grows a short exam name until it fills the width, up to 1.6 of the reference', () => {
    const { frame } = render({ titulo: '# PF', apelo: OFFER });
    expect(sizeOf(find(frame, 'PF')!.node)).toBeCloseTo(GRID.name.size * 1.6, 5);
  });

  it('shrinks a long exam name to one line of the width, above the floor', () => {
    const { frame } = render({ titulo: '# Concurso Prefeitura de Lagoa Santa', apelo: OFFER });
    const name = find(frame, 'LAGOA SANTA')!;
    expect(layOut(name.node)).toHaveLength(1);
    expect(sizeOf(name.node)).toBeLessThan(GRID.name.size);
  });
});
