/**
 * `anuncio` — a performance remarketing ad for one exam: the exam's facts at the head and an
 * offer below, in a feed post (1080×1350) and a story (1080×1920).
 *
 * The brief writes the exam once (`::concurso`) and one `::versao` per artwork: the offer
 * version and the timeless one are two occurrences of the same repeating slot, so one brief
 * draws the four boards of the reference PSDs (two versions × two formats).
 *
 * The head's layout (`cabeca`) and the offer's (`oferta`) are enum slots, so each named variant
 * (`vitrine-cartao`, `faixa-lista`…) is a configuration of the plugin file that defaults them
 * (Tyto ADR 0151, TYTO-440). **Only `vitrine` and `cartao` are drawn so far**, whatever the
 * slots say; the other layouts arrive one at a time.
 *
 * ## vitrine + cartao
 *
 * The photograph fills the top; a panel with rounded top corners rises over it and holds,
 * centred: the status line, the exam's name in capitals and the accent, the supporting lines,
 * the salary, then the offer card (a title, a band in the accent, a foot line), the proof of
 * approvals and the logo. Every number below is the reference's (piece 38 of the study, its
 * four boards), read from the PSD's layers: a text is placed by the top of its capitals. A
 * layer's top is that, except where a glyph rises above the capitals: the name's is its
 * baseline less its capital height (the parentheses of `(RS)` rise 10 px higher), and the
 * salary's sits 4 to 5 px under the top of its `$`, measured on the render against the PSD.
 *
 * The logo is the brand kit's (Tyto ADR 0063), a placeholder without one; every colour is a
 * declared value (Tyto ADR 0153).
 */

import { colorValue, frame, group, image, rect, solid } from '@tyto/core/template';
import { drawLogo, oneInk } from '@tyto/house-style';
import {
  at,
  grownTextBlock,
  labelOf,
  lines,
  naturalWidth,
  plain,
  reportOverflow,
} from '@tyto/template-kit';

import type { Inline, RichText, TemplateBuild, TemplateContext } from '@tyto/core';
import type { NodeDraft } from '@tyto/core/template';
import type { Measure, TextStyle } from '@tyto/template-kit';

/* ------------------------------------------------------------------------- the tokens -- */

/** The colours, by declared value name, each default the reference's. */
export const COLOR_DEFAULTS = {
  /** The exam's name, the card's outline and its band. */
  accent: '#1363d0',
  /** The panel under the words. */
  paper: '#f7f4f4',
  /** Every word on the panel. */
  ink: '#4d4d4d',
  /** The words on the band. */
  'on-accent': '#eceaea',
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;
type Ink = (name: ColorName) => string;

const FACE = { family: 'CircularXX', source: 'system' } as const;
const LIGHT = 300;
const MEDIUM = 500;
/**
 * The band's words are CircularXX ExtraBlack (950) in the reference. The scene stops at 900
 * (TYTO-797), so they are set in Black until that card lands.
 */
const BLACK = 900;

/**
 * CircularXX's vertical metrics, in em (`OS/2`, the same in every weight). A line of height
 * `lineHeight` puts the content area in its middle, so the capitals start this far below the
 * line's top. The same numbers `concursos-abertos` measured; they move to the kit in TYTO-793.
 */
const ASCENT = 0.75;
const DESCENT = 0.25;
const CAP_HEIGHT = 0.709;
const LINE_HEIGHT = 1;

function capOffset(size: number): number {
  return size * ((LINE_HEIGHT - (ASCENT + DESCENT)) / 2 + (ASCENT - CAP_HEIGHT));
}

/** Where a text goes: the top of its capitals, and its size. */
interface Spot {
  readonly capTop: number;
  readonly size: number;
}

/** One format's geometry, in the frame's pixels, read from the reference's layers. */
interface Geometry {
  /** The panel's top edge and its top corners' radius. */
  readonly panelTop: number;
  readonly panelRadius: number;
  readonly kicker: Spot;
  readonly name: Spot;
  readonly support: Spot;
  readonly salary: Spot;
  /** The card's box; its band spans the card's width. */
  readonly card: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly band: { readonly y: number; readonly h: number };
  readonly title: Spot;
  readonly bandText: Spot;
  readonly foot: Spot;
  readonly proof: Spot;
  readonly logo: { readonly top: number; readonly height: number };
}

/** The feed post, board `1350_v1` of the reference. */
export const GRID: Geometry = {
  panelTop: 486,
  panelRadius: 105,
  kicker: { capTop: 523, size: 54.7 },
  name: { capTop: 607, size: 69.6 },
  support: { capTop: 711, size: 39 },
  salary: { capTop: 766, size: 52 },
  card: { x: 142, y: 872, w: 796, h: 266 },
  band: { y: 948, h: 117 },
  title: { capTop: 891, size: 50 },
  bandText: { capTop: 983, size: 60.3 },
  foot: { capTop: 1084, size: 33.6 },
  proof: { capTop: 1171, size: 33.3 },
  logo: { top: 1245, height: 62 },
};

/** The story, board `1920_v1` of the reference. */
export const STORY: Geometry = {
  panelTop: 745,
  panelRadius: 105,
  kicker: { capTop: 834, size: 62.3 },
  name: { capTop: 929, size: 79.4 },
  support: { capTop: 1072, size: 39 },
  salary: { capTop: 1142, size: 66.4 },
  card: { x: 105, y: 1263, w: 870, h: 290 },
  band: { y: 1347, h: 127 },
  title: { capTop: 1283, size: 54.7 },
  bandText: { capTop: 1384, size: 66 },
  foot: { capTop: 1495, size: 36.8 },
  proof: { capTop: 1590, size: 36.5 },
  logo: { top: 1687, height: 71 },
};

/** A frame taller than one and a half times its width is laid out as the story. */
export function geometryOf(size: { readonly w: number; readonly h: number }): Geometry {
  return size.h / size.w > 1.5 ? STORY : GRID;
}

/** The panel's side margin for every text, and the card's inner margin for its words. */
export const TEXT_MARGIN = 60;
const CARD_PADDING = 48;
/** The smallest a card's line shrinks to before it wraps instead. */
const FIT_FLOOR = 0.7;
/**
 * The least room between one line of the head and the top of the capitals under it. The
 * reference leaves 17 to 67 px; a line that wrapped pushes the next one down to this.
 */
const LINE_GAP = 14;
/** The least room between the head's last line and the card, the reference's (56 to 57 px). */
const HEAD_GAP = 56;
/** The least room between the proof and the logo, the reference's feed post (42 px). */
const PROOF_GAP = 42;
/** The panel never rises above this share of its reference top; past it the head overflows. */
const PANEL_RISE_FLOOR = 0.5;
/** The photograph's stand-in when the brief names none. */
const NO_PHOTO = '#c9ccd2';

/* --------------------------------------------------------------------- the brief -- */

const EMPTY: RichText = [];

/** A rich-text slot's words, or nothing when the brief left it out. */
export function wordsOf(context: TemplateContext, name: string): RichText {
  const value = context.slots[name]?.value;
  return value?.kind === 'rich-text' ? value.text : EMPTY;
}

/**
 * A label as the brief may write it, accents, case and the trailing colon `labelOf` keeps
 * aside: `Salário:` and `salario` agree.
 */
function keyOf(label: RichText): string {
  return plain(label)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/:\s*$/u, '')
    .trim()
    .toLowerCase();
}

/** A block's lines read as the lines with no label, in order, and the labelled ones by label. */
export interface Fields {
  readonly unlabelled: readonly RichText[];
  readonly labelled: ReadonlyMap<string, readonly RichText[]>;
}

export function fieldsOf(text: RichText): Fields {
  const unlabelled: RichText[] = [];
  const labelled = new Map<string, RichText[]>();
  for (const line of lines(text)) {
    if (plain(line).trim() === '') continue;
    const { label, text: value } = labelOf(line);
    if (label === undefined) {
      unlabelled.push(line);
      continue;
    }
    const key = keyOf(label);
    labelled.set(key, [...(labelled.get(key) ?? []), value]);
  }
  return { unlabelled, labelled };
}

function first(fields: Fields, ...keys: string[]): RichText | undefined {
  for (const key of keys) {
    const found = fields.labelled.get(key)?.[0];
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Lines joined into one text, each on its own line. */
function joined(parts: readonly RichText[]): RichText {
  return parts.flatMap((part, index): Inline[] => {
    if (index === 0) return [...part];
    const at = part[0]?.range.start ?? 0;
    return [{ kind: 'break', range: { start: at, end: at } }, ...part];
  });
}

/** The same words in capitals, bold and marks kept. */
export function upper(text: RichText): RichText {
  return text.map((inline): Inline => {
    switch (inline.kind) {
      case 'text':
        return { ...inline, value: inline.value.toLocaleUpperCase('pt-BR') };
      case 'bold':
      case 'italic':
      case 'mark':
        return { ...inline, children: upper(inline.children) };
      default:
        return inline;
    }
  });
}

/* -------------------------------------------------------------------------- the build -- */

export const build: TemplateBuild = (context: TemplateContext) => {
  const ink: Ink = (name) => colorValue(context, name, COLOR_DEFAULTS[name]);
  const geometry = geometryOf(context.size);
  const exam = fieldsOf(wordsOf(context, 'concurso'));
  const version = fieldsOf(wordsOf(context, 'versao'));

  // Laid out from the bottom up, because the logo is the one thing that never moves: the proof
  // sits above the logo, the card above the proof, and the head above the card. Each starts at
  // the reference's place and rises only as far as the words under it grew.
  const proofWords = first(exam, 'aprovacao');
  const proof =
    proofWords === undefined
      ? undefined
      : centredBlock(context, 'aprovacao', proofWords, geometry.proof, LIGHT, ink('ink'));
  const proofLift = Math.max(0, (proof?.bottom ?? 0) + PROOF_GAP - geometry.logo.top);

  const offer = cartao(context, ink, geometry, version);
  const cardTop = geometry.card.y - offer.growth - proofLift;

  const head = vitrine(context, ink, geometry, exam);
  const wanted = Math.max(0, head.bottom + HEAD_GAP - cardTop);
  // The panel rises over the photograph to make room, down to a floor that keeps the photograph.
  const headLift = Math.min(wanted, geometry.panelTop * (1 - PANEL_RISE_FLOOR));
  reportOverflow(context.report, head.bottom - headLift + HEAD_GAP, cardTop);

  const logo = drawLogo(context.brand, geometry.logo.height, oneInk(ink('accent')));
  const panelTop = geometry.panelTop - headLift;

  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid(ink('paper')),
    children: [
      photo(context, geometry),
      rect({
        name: 'painel',
        size: { w: context.size.w, h: context.size.h - panelTop },
        radius: [geometry.panelRadius, geometry.panelRadius, 0, 0],
        fill: solid(ink('paper')),
        transform: { y: panelTop },
      }),
      lifted('cabeca', head.nodes, headLift),
      lifted('oferta', offer.nodes, proofLift),
      ...(proof === undefined ? [] : [lifted('prova', [proof.node], proofLift)]),
      at((context.size.w - logo.width) / 2, geometry.logo.top, logo),
    ],
  });
};

/** Nodes drawn `lift` pixels higher than they were placed. */
function lifted(name: string, nodes: readonly NodeDraft[], lift: number): NodeDraft {
  return group({ name, children: nodes, transform: { y: -lift } });
}

/** The head's photograph, filling the frame's width down to below the panel's corners. */
function photo(context: TemplateContext, geometry: Geometry): NodeDraft {
  const size = { w: context.size.w, h: geometry.panelTop + geometry.panelRadius };
  const value = context.slots['foto']?.value;
  if (value?.kind === 'image') {
    return image({ name: 'foto', asset: value.asset, size, fit: 'cover' });
  }
  return rect({ name: 'foto', size, fill: solid(NO_PHOTO) });
}

/* ------------------------------------------------------------------- vitrine (head) -- */

interface Head {
  readonly nodes: NodeDraft[];
  /** Where the lowest of its words ends. */
  readonly bottom: number;
}

/**
 * The status line, the exam's name, the supporting lines and the salary, centred.
 *
 * Lines with no label are, in order, the status line, the exam's name and supporting lines.
 * `Vagas:` and `Banca:` share one supporting line, with their labels; `Salário:` is the
 * salary line, drawn without its label; `Aprovação:` is drawn under the card.
 */
function vitrine(context: TemplateContext, ink: Ink, geometry: Geometry, exam: Fields): Head {
  const [kicker, name, ...support] = exam.unlabelled;
  const facts = ['vagas', 'banca'].flatMap((key) =>
    (exam.labelled.get(key) ?? []).map((value) => labelledLine(key, value)),
  );
  const supportText = joined([...support, ...(facts.length === 0 ? [] : [sideBySide(facts)])]);
  const salary = first(exam, 'salario');

  const nodes: NodeDraft[] = [];
  let bottom = 0;
  // Each line keeps the reference's place unless the one above wrapped down to it.
  const place = (
    slot: string,
    words: RichText | undefined,
    spot: Spot,
    weight: number,
    color: string,
  ): void => {
    if (words === undefined || plain(words).trim() === '') return;
    const capTop = bottom === 0 ? spot.capTop : Math.max(spot.capTop, bottom + LINE_GAP);
    const placed = centredBlock(context, slot, words, { ...spot, capTop }, weight, color);
    nodes.push(placed.node);
    bottom = placed.bottom;
  };

  place('sobretitulo', kicker, geometry.kicker, MEDIUM, ink('ink'));
  place(
    'concurso',
    name === undefined ? undefined : upper(name),
    geometry.name,
    BLACK,
    ink('accent'),
  );
  place('apoio', supportText, geometry.support, LIGHT, ink('ink'));
  place('salario', salary, geometry.salary, MEDIUM, ink('ink'));

  return { nodes, bottom };
}

/** Facts on one line, a middle dot between them: `Vagas: 40 · Banca: Ômegas`. */
function sideBySide(facts: readonly RichText[]): RichText {
  return facts.flatMap((fact, index): Inline[] => {
    if (index === 0) return [...fact];
    const at = fact[0]?.range.start ?? 0;
    return [{ kind: 'text', value: ' · ', range: { start: at, end: at } }, ...fact];
  });
}

/** `Vagas: 40` back as one line, its label written as the house writes it. */
function labelledLine(key: string, value: RichText): RichText {
  const label = key === 'vagas' ? 'Vagas' : 'Banca';
  const start = value[0]?.range.start ?? 0;
  return [{ kind: 'text', value: `${label}: `, range: { start, end: start } }, ...value];
}

/* ------------------------------------------------------------------- cartao (offer) -- */

/**
 * The offer as a card: `Oferta:` its title, `Desconto:` (or `Destaque:`) on the band in the
 * accent, `Prazo:`, `Garantia:` or `Cupom:` its foot. A line the card does not hold is not
 * drawn. The title and the band's words shrink to one line before they wrap.
 */
function cartao(context: TemplateContext, ink: Ink, geometry: Geometry, version: Fields): Offer {
  const { card, band } = geometry;
  const inner = card.w - 2 * CARD_PADDING;
  const words: NodeDraft[] = [];

  // A title that wraps even at the floor grows the card upward: its last line keeps the
  // reference's place above the band, and the lines before it take room from the head.
  let growth = 0;
  const title = first(version, 'oferta');
  if (title !== undefined) {
    const placed = fitted(
      context,
      'oferta',
      title,
      geometry.title,
      LIGHT,
      ink('ink'),
      card,
      inner,
      true,
    );
    growth = placed.extra;
    words.push(placed.node);
  }
  const bandWords = first(version, 'desconto', 'destaque');
  if (bandWords !== undefined) {
    const placed = fitted(
      context,
      'desconto',
      bandWords,
      geometry.bandText,
      BLACK,
      ink('on-accent'),
      card,
      inner,
    );
    words.push(placed.node);
  }
  const foot = first(version, 'prazo', 'garantia', 'cupom');
  if (foot !== undefined) {
    words.push(fitted(context, 'rodape', foot, geometry.foot, LIGHT, ink('ink'), card, inner).node);
  }

  const nodes: NodeDraft[] = [
    rect({
      name: 'cartao',
      size: { w: card.w, h: card.h + growth },
      radius: 39,
      stroke: { paint: solid(ink('accent')), width: 2, align: 'inside' },
      transform: { x: card.x, y: card.y - growth },
    }),
    rect({
      name: 'faixa',
      size: { w: card.w, h: band.h },
      fill: solid(ink('accent')),
      effects: [
        { kind: 'shadow', x: 0, y: 8, blur: 32, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.35 } },
      ],
      transform: { x: card.x, y: band.y },
    }),
    ...words,
  ];
  return { nodes, growth };
}

interface Offer {
  readonly nodes: NodeDraft[];
  /** How much taller than the reference's card the title made it, all of it above. */
  readonly growth: number;
}

/* ------------------------------------------------------------------ placing words -- */

function styleOf(size: number, weight: number, color: string): TextStyle {
  return { font: FACE, size, weight, color };
}

/** Words centred across the frame between the text margins, placed by their capitals' top. */
function centredBlock(
  context: TemplateContext,
  name: string,
  words: RichText,
  spot: Spot,
  weight: number,
  color: string,
): { node: NodeDraft; bottom: number } {
  const width = context.size.w - 2 * TEXT_MARGIN;
  const block = grownTextBlock(
    words,
    width,
    0,
    styleOf(spot.size, weight, color),
    context.measure,
    { name, align: 'center', lineHeight: LINE_HEIGHT, overflow: 'grow' },
  );
  const top = spot.capTop - capOffset(spot.size);
  return { node: at(TEXT_MARGIN, top, block), bottom: top + block.height };
}

/**
 * Words centred in the card, shrunk to one line when they are wider than its inside, and
 * wrapped past the floor. `extra` is how much taller than one line they came out.
 */
function fitted(
  context: TemplateContext,
  name: string,
  words: RichText,
  spot: Spot,
  weight: number,
  color: string,
  card: Geometry['card'],
  inner: number,
  growUp = false,
): { node: NodeDraft; extra: number } {
  const size = fitSize(words, spot.size, weight, color, inner, context.measure);
  const block = grownTextBlock(words, inner, 0, styleOf(size, weight, color), context.measure, {
    name,
    align: 'center',
    lineHeight: LINE_HEIGHT,
    overflow: 'grow',
  });
  // A shrunk line keeps the centre of the reference's line, not its top.
  const capTop = spot.capTop + (CAP_HEIGHT * (spot.size - size)) / 2;
  const extra = Math.max(0, block.height - size * LINE_HEIGHT);
  // Growing up, the last line takes the reference's place and the lines before it rise.
  const top = capTop - capOffset(size) - (growUp ? extra : 0);
  return { node: at(card.x + CARD_PADDING, top, block), extra };
}

/** The size at which the words fit one line of `width`, never below the floor. */
function fitSize(
  words: RichText,
  size: number,
  weight: number,
  color: string,
  width: number,
  measure: Measure,
): number {
  const natural = naturalWidth(words, styleOf(size, weight, color), measure);
  if (natural === undefined || natural <= width) return size;
  return Math.max(size * FIT_FLOOR, (size * width) / natural);
}
