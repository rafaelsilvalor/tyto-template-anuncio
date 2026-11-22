/**
 * `anuncio` — a performance remarketing ad for one exam: the exam's facts at the head and an
 * offer below, in a feed post (1080×1350) and a story (1080×1920).
 *
 * The brief speaks Tyto's shared vocabulary (`docs/slot-vocabulary.md`): `::titulo` once, the
 * head for every artwork; one `::lamina` per artwork, the offer version and the timeless one,
 * each with its own `::apelo`; `::nota` once, the line under the card. One brief draws the four
 * boards of the reference PSDs (two versions × two formats).
 *
 * The head's layout (`cabeca`) and the offer's (`oferta`) are enum slots, so each named variant
 * (`vitrine-cartao`, `faixa-lista`…) is a configuration of the plugin file that defaults them
 * (Tyto ADR 0151, TYTO-440). **Only `vitrine` and `cartao` are drawn so far**, whatever the
 * slots say; the other layouts arrive one at a time.
 *
 * ## vitrine + cartao
 *
 * The photograph fills the top; a panel with rounded top corners rises over it and holds,
 * centred: the head's lines, then the offer card, the note and the logo.
 *
 * **The head is ranked by the brief, not by this file.** Its lines are read with the kit's
 * `levelsOf` (`|` between parts, `#` to `###` for a part's level, `---` for the divider) and
 * stacked with `levelStack`; this file says only what each level looks like. Every size is the
 * reference's (piece 38 of the study), read from the PSD's layers.
 *
 * **The card takes the shape of the `apelo`'s parts.** The line's main part is the band; the
 * parts before it are the card's title, the parts after it its foot. A segment at an edge takes
 * that edge's corners, so a card with no title has its band on top with rounded top corners.
 * This is the shape TYTO-800 moves into the kit.
 *
 * The logo is the brand kit's (Tyto ADR 0063), a placeholder without one; every colour is a
 * declared value (Tyto ADR 0153).
 */

import { colorValue, frame, image, rect, solid } from '@tyto/core/template';
import { drawLogo, oneInk } from '@tyto/house-style';
import {
  at,
  block,
  blockColumn,
  bodyBlock,
  bodySize,
  card as drawCard,
  cardSegments,
  grownTextBlock,
  inset,
  levelStack,
  levelsOf,
  mainLineScale,
  naturalWidth,
  parameterValues,
  plain,
  reportOverflow,
  row,
  weightOf,
} from '@tyto/template-kit';

import type { Inline, RichText, TemplateBuild, TemplateContext } from '@tyto/core';
import type { NodeDraft } from '@tyto/core/template';
import type {
  Area,
  Block,
  CardRole,
  ColumnEntry,
  LevelItem,
  LevelLook,
  LevelPart,
  Measure,
  ParameterSchema,
  TextStyle,
} from '@tyto/template-kit';

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

/** Every line is as tall as its size: CircularXX's ascent and descent sum to one em. */
const LINE_HEIGHT = 1;

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
  /** From the panel's top edge to the top of the column of blocks: the reference's head top. */
  readonly panelPadding: number;
  /** Between the card and the note, box to box. */
  readonly proofGap: number;
  /** The head's first line: the reference's status line, whose top the head starts at. */
  readonly kicker: Spot;
  /** `#`, the exam's name. */
  readonly name: Spot;
  /** The base level: the supporting lines. */
  readonly support: Spot;
  /** `##` after the main part: the salary line. */
  readonly salary: Spot;
  /** Between two parts of one line, box to box. */
  readonly partGap: number;
  /** Under the line holding `#`, the exam's name, box to box. */
  readonly nameGap: number;
  /** Between any other two lines, or a line and the divider, box to box. */
  readonly lineGap: number;
  /** The card's box; its band spans the card's width. */
  readonly card: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly band: { readonly y: number; readonly h: number };
  readonly title: Spot;
  readonly bandText: Spot;
  readonly foot: Spot;
  readonly proof: Spot;
  readonly logo: { readonly top: number; readonly height: number };
}

/**
 * The feed post, board `1350_v1` of the reference. The gaps are the reference's room between
 * boxes: status to name 28.6 px; name to supporting line 35.6; supporting line to salary 15.5,
 * which two supporting lines in a row keep too, so they read as one group (TYTO-811).
 */
export const GRID: Geometry = {
  panelTop: 486,
  panelRadius: 105,
  panelPadding: 35,
  proofGap: 32,
  kicker: { capTop: 523, size: 54.7 },
  name: { capTop: 607, size: 69.6 },
  support: { capTop: 711, size: 39 },
  salary: { capTop: 766, size: 52 },
  partGap: 29,
  nameGap: 35.6,
  lineGap: 15.5,
  card: { x: 142, y: 872, w: 796, h: 266 },
  band: { y: 948, h: 117 },
  title: { capTop: 891, size: 50 },
  bandText: { capTop: 983, size: 60.3 },
  foot: { capTop: 1084, size: 33.6 },
  proof: { capTop: 1171, size: 33.3 },
  logo: { top: 1245, height: 62 },
};

/** The story, board `1920_v1` of the reference: status to name 32 px, the lines 65 and 30. */
export const STORY: Geometry = {
  panelTop: 745,
  panelRadius: 105,
  panelPadding: 86,
  proofGap: 36,
  kicker: { capTop: 834, size: 62.3 },
  name: { capTop: 929, size: 79.4 },
  support: { capTop: 1072, size: 39 },
  salary: { capTop: 1142, size: 66.4 },
  partGap: 32,
  nameGap: 65,
  lineGap: 30,
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
const CARD_RADIUS = 39;
/** The smallest a card's line shrinks to before it wraps instead. */
const FIT_FLOOR = 0.7;
/** The photograph's stand-in when the brief names none. */
const NO_PHOTO = '#c9ccd2';
/** A base-level part before the main one is tracked out, in em: `C O N C U R S O`. */
const TRACKING = 0.8;
/** The divider's three dots: their diameter and the room between them, in px. */
const DOT = 12;
const DOT_GAP = 10;

/* --------------------------------------------------------------------- the brief -- */

const EMPTY: RichText = [];

/** A rich-text slot's words, or nothing when the brief left it out. */
export function wordsOf(context: TemplateContext, name: string): RichText {
  const value = context.slots[name]?.value;
  return value?.kind === 'rich-text' ? value.text : EMPTY;
}

/** Lines joined into one text, each on its own line. */
function joined(parts: readonly RichText[]): RichText {
  return parts.flatMap((part, index): Inline[] => {
    if (index === 0) return [...part];
    const start = part[0]?.range.start ?? 0;
    return [{ kind: 'break', range: { start, end: start } }, ...part];
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

/**
 * The template's own parameters (Tyto ADR 0224): every number the arrangement uses, with the
 * reference's value as its default. The kit's pieces declare theirs beside them.
 */
export const ANUNCIO_PARAMETERS = {
  headGap: {
    kind: 'length',
    default: 56,
    min: 0,
    description: "The room between the head and the next block, the reference's (56 to 57 px).",
  },
  noteGap: {
    kind: 'length',
    default: 42,
    min: 0,
    description: "The room between the column and the logo, the reference's feed post (42 px).",
  },
  photoShare: {
    kind: 'ratio',
    default: 0.25,
    min: 0,
    max: 1,
    description:
      "The least share of the frame's height the photograph keeps when the panel rises (maintainer, 2026-11-21: 338 of 1350, 480 of 1920).",
  },
  segmentPadding: {
    kind: 'length',
    default: 16,
    min: 0,
    description:
      "The least room above and below a card segment's words, at scale 1: the reference has 17 px between the card's top and its title's capitals.",
  },
  headShare: {
    kind: 'ratio',
    default: 0.5,
    min: 0,
    max: 1,
    description: "The most of the panel's room the head may take when its main line grows.",
  },
  unmarkedRatio: {
    kind: 'ratio',
    default: 0.8,
    min: 0,
    max: 1,
    description:
      'A line with no # mark, in the title and in the body, as a share of the smallest marked size: the unmarked level is always the smallest (maintainer, 2026-11-22).',
  },
} as const satisfies ParameterSchema;

/**
 * The composition, top to bottom: the photograph, the panel over it, and in the panel one column
 * of the kit (TYTO-824) holding the head, the offer card and the note, in the order the brief
 * wrote them, centred together between the panel's top and the logo. The logo is pinned at the
 * foot. A column taller than its room shrinks every block by one factor to 0.7, then raises the
 * panel over the photograph until the photograph keeps a quarter of the frame, then reports what
 * is left (TYTO-825).
 */
export const build: TemplateBuild = (context: TemplateContext) => {
  const ink: Ink = (name) => colorValue(context, name, COLOR_DEFAULTS[name]);
  const geometry = geometryOf(context.size);
  const values = parameterValues(ANUNCIO_PARAMETERS);

  const top = geometry.panelTop + geometry.panelPadding;
  const area = {
    width: context.size.w - 2 * TEXT_MARGIN,
    height: geometry.logo.top - values.noteGap - top,
  };
  const reach = Math.max(0, geometry.panelTop - context.size.h * values.photoShare);

  const titulo = levelsOf(wordsOf(context, 'titulo'));
  const corpo = wordsOf(context, 'corpo');
  const apelo = levelsOf(wordsOf(context, 'apelo'));
  const nota = wordsOf(context, 'nota');
  const entries: ColumnEntry[] = [
    {
      name: 'titulo',
      scale: weightOf(context.slots['titulo']),
      build: (room, scale) => head(context, ink, geometry, titulo, room, scale, values.headShare),
    },
    {
      name: 'corpo',
      scale: weightOf(context.slots['corpo']),
      build: (room, scale) => body(context, ink, geometry, corpo, room, scale),
    },
    {
      name: 'apelo',
      scale: weightOf(context.slots['apelo']),
      build: (_room, scale) =>
        offer(context, ink, geometry, apelo, scale, values.segmentPadding * scale),
    },
    {
      name: 'nota',
      scale: weightOf(context.slots['nota']),
      build: (room, scale) => note(context, ink, geometry, nota, room, scale),
    },
  ];
  const column = blockColumn(area, {
    name: 'coluna',
    entries,
    order: context.order,
    gapBetween: (above, below) => {
      // The body reads as the head's continuation: under the name it keeps the name's own gap.
      if (above === 'titulo' && below === 'corpo') return geometry.nameGap;
      const isHead = (name: string): boolean => name === 'titulo' || name === 'corpo';
      return isHead(above) || isHead(below) ? values.headGap : geometry.proofGap;
    },
    parameters: { reach },
  });
  reportOverflow(context.report, column.overflow, 0);

  const panelTop = geometry.panelTop - column.rise;
  const logo = drawLogo(context.brand, geometry.logo.height, oneInk(ink('accent')));

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
      at(TEXT_MARGIN, top - column.rise, column.block),
      at((context.size.w - logo.width) / 2, geometry.logo.top, logo),
    ],
  });
};

/** The head's photograph, filling the frame's width down to below the panel's corners. */
function photo(context: TemplateContext, geometry: Geometry): NodeDraft {
  const size = { w: context.size.w, h: geometry.panelTop + geometry.panelRadius };
  const value = context.slots['imagem']?.value;
  if (value?.kind === 'image') {
    return image({ name: 'imagem', asset: value.asset, size, fit: 'cover' });
  }
  return rect({ name: 'imagem', size, fill: solid(NO_PHOTO) });
}

/* ------------------------------------------------------------------- vitrine (head) -- */

/**
 * The head: `::titulo`'s lines, ranked by their marks and stacked. Its `#` part grows to fill
 * the width (the kit's `mainLineScale`, between 0.7 and 1.6 of the reference) as long as the
 * head takes no more than `headShare` of the panel's room; every other level follows by the
 * same ratio, and so do the gaps. The brief's `peso` scales that again, never past the width
 * the main line fills.
 */
function head(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  items: readonly LevelItem[],
  room: Area,
  scale: number,
  headShare: number,
): Block | undefined {
  if (items.length === 0) return undefined;
  const reference = (part: LevelPart): LevelLook => lookOf(part, geometry, ink, 1);
  const stackAt = (ratio: number): Block =>
    levelStack(
      items,
      {
        name: 'titulo',
        look: (part) => lookOf(part, geometry, ink, ratio),
        gap: geometry.partGap * ratio,
        lineGap: (above) => lineGapOf(above, geometry) * ratio,
        divider: () => dots(ink('ink'), ratio),
      },
      room.width,
      context.measure,
    );
  const fill = mainLineScale(
    { width: room.width, height: Infinity },
    { items, look: reference, measure: context.measure, parameters: { maxScale: Infinity } },
  );
  const fitted = mainLineScale(
    { width: room.width, height: room.height * headShare },
    {
      items,
      look: reference,
      measure: context.measure,
      heightAt: (ratio) => stackAt(ratio).height,
    },
  );
  const drawn = stackAt(Math.min(fitted * scale, Math.max(fill, fitted)));
  return drawn.height > 0 ? drawn : undefined;
}

/** The room under a line: the name's own, larger, or the one every other pair shares. */
export function lineGapOf(above: LevelItem, geometry: Geometry): number {
  const holdsName = above.kind === 'line' && above.parts.some((part) => part.level === 1);
  return holdsName ? geometry.nameGap : geometry.lineGap;
}

/**
 * What each level of the head looks like at a ratio of the reference: `#` the exam's name, in
 * capitals and the accent; `##` before it the status line, after it the salary; `###` a
 * supporting line in Medium; the base level a supporting line, or, before the name, a tracked
 * label in the accent.
 */
function lookOf(part: LevelPart, geometry: Geometry, ink: Ink, ratio: number): LevelLook {
  const look = (spot: Spot, weight: number, color: string): LevelLook => ({
    style: styleOf(spot.size * ratio, weight, color),
    lineHeight: LINE_HEIGHT,
  });
  const unmarked: Spot = { capTop: geometry.support.capTop, size: unmarkedSize(geometry) };
  switch (part.level) {
    case 1:
      return { ...look(geometry.name, BLACK, ink('accent')), transform: upper };
    case 2:
      return part.position === 'before'
        ? look(geometry.kicker, MEDIUM, ink('ink'))
        : look(geometry.salary, MEDIUM, ink('ink'));
    case 3:
      return look(geometry.support, MEDIUM, ink('ink'));
    default:
      return part.position === 'before'
        ? {
            ...look(unmarked, LIGHT, ink('accent')),
            letterSpacing: unmarked.size * ratio * TRACKING,
            transform: upper,
          }
        : look(unmarked, LIGHT, ink('ink'));
  }
}

/** The marked levels' sizes the title and the body share: `#` the name, `##`, `###`. */
function markedSizes(geometry: Geometry): Readonly<Record<1 | 2 | 3, number>> {
  return {
    1: geometry.name.size,
    2: Math.min(geometry.kicker.size, geometry.salary.size),
    3: geometry.support.size,
  };
}

/** A line with no mark: the smallest marked size times `unmarkedRatio` (the kit's `bodySize`). */
function unmarkedSize(geometry: Geometry): number {
  const { unmarkedRatio } = parameterValues(ANUNCIO_PARAMETERS);
  return bodySize(0, markedSizes(geometry), { unmarkedRatio });
}

/* ---------------------------------------------------------------------- corpo (body) -- */

/**
 * The body: `::corpo`'s lines of general information (vacancies, exam board, roles, salary),
 * read by the same marks as the head and drawn by the kit's `bodyBlock` (TYTO-831), at their
 * own scale. `##` is the salary's look, `###` a supporting line in Medium, an unmarked line the
 * smallest, in Light. No `::corpo`, no block: a brief that keeps its facts in `::titulo` draws
 * them there, as 0.4.0 did.
 */
function body(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  words: RichText,
  room: Area,
  scale: number,
): Block | undefined {
  const { unmarkedRatio } = parameterValues(ANUNCIO_PARAMETERS);
  const sizes = markedSizes(geometry);
  return bodyBlock(room, scale, {
    words,
    sizes: { 1: sizes[1], 2: geometry.salary.size, 3: sizes[3] },
    look: (part, size) => ({
      style: styleOf(
        size,
        part.level === 1 ? BLACK : part.level === 0 ? LIGHT : MEDIUM,
        part.level === 1 ? ink('accent') : ink('ink'),
      ),
      lineHeight: LINE_HEIGHT,
    }),
    measure: context.measure,
    divider: (_width, ratio) => dots(ink('ink'), ratio),
    parameters: { unmarkedRatio, partGap: geometry.partGap, lineGap: geometry.lineGap },
    name: 'corpo',
  });
}

/** The divider: three dots, centred. */
function dots(color: string, ratio: number): Block {
  const size = DOT * ratio;
  const dot = (): Block =>
    block(
      size,
      size,
      rect({ name: 'ponto', size: { w: size, h: size }, radius: size / 2, fill: solid(color) }),
    );
  return row({ name: 'divisor', items: [dot(), dot(), dot()], gap: DOT_GAP * ratio });
}

/* ------------------------------------------------------------------- cartao (offer) -- */

/**
 * The offer as a card shaped by `::apelo`'s parts: the main part is the band, the parts before
 * it the title, the parts after it the foot (later lines join the foot). Each segment keeps the
 * reference's height at the scale, its words centred in it; words that wrap grow their segment.
 * Band and title words shrink to one line before they wrap, down to 0.7. No `::apelo`, no card.
 */
function offer(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  items: readonly LevelItem[],
  scale: number,
  padding: number,
): Block | undefined {
  const { card, band } = geometry;
  const inner = card.w - 2 * CARD_PADDING;
  const words = (parts: readonly LevelPart[]): RichText => joined(parts.map((part) => part.words));
  const segmentOf = (role: CardRole, parts: readonly LevelPart[]): Block =>
    inset({ item: segmentWords(role, parts), padding: [padding, 0, padding, 0] });
  const segmentWords = (role: CardRole, parts: readonly LevelPart[]): Block => {
    switch (role) {
      case 'band':
        return fitted(context, 'faixa-texto', words(parts), {
          size: geometry.bandText.size * scale,
          weight: BLACK,
          color: ink('on-accent'),
          inner,
          shrink: true,
        });
      case 'title':
        return fitted(context, 'oferta', words(parts), {
          size: geometry.title.size * scale,
          weight: LIGHT,
          color: ink('ink'),
          inner,
          shrink: true,
        });
      case 'foot':
        return fitted(context, 'rodape', words(parts), {
          size: geometry.foot.size * scale,
          weight: LIGHT,
          color: ink('ink'),
          inner,
          shrink: false,
        });
    }
  };
  const segments = cardSegments(items, segmentOf, {
    title: (band.y - card.y) * scale,
    band: band.h * scale,
    foot: (card.y + card.h - band.y - band.h) * scale,
  });
  if (segments.length === 0) return undefined;
  return drawCard(segments, {
    name: 'cartao',
    width: card.w,
    radius: CARD_RADIUS,
    stroke: { paint: solid(ink('accent')), width: 2, align: 'inside' },
    band: {
      name: 'faixa',
      fill: solid(ink('accent')),
      effects: [
        { kind: 'shadow', x: 0, y: 8, blur: 32, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.35 } },
      ],
    },
  });
}

/* ---------------------------------------------------------------------- nota (note) -- */

/** The note: its words centred across the column, at the reference's size times the scale. */
function note(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  words: RichText,
  room: Area,
  scale: number,
): Block | undefined {
  if (plain(words).trim() === '') return undefined;
  return grownTextBlock(
    words,
    room.width,
    0,
    styleOf(geometry.proof.size * scale, LIGHT, ink('ink')),
    context.measure,
    { name: 'nota', align: 'center', lineHeight: LINE_HEIGHT, overflow: 'grow' },
  );
}

/* ------------------------------------------------------------------ placing words -- */

function styleOf(size: number, weight: number, color: string): TextStyle {
  return { font: FACE, size, weight, color };
}

interface Setting {
  readonly size: number;
  readonly weight: number;
  readonly color: string;
  /** The card's inside, which the words are as wide as. */
  readonly inner: number;
  /** Whether a line wider than the inside shrinks to one line, down to the floor, first. */
  readonly shrink: boolean;
}

/** Words centred in the card's inside; wrapped past the shrink floor. */
function fitted(context: TemplateContext, name: string, words: RichText, setting: Setting): Block {
  const { weight, color, inner } = setting;
  const size = setting.shrink
    ? fitSize(words, setting.size, weight, color, inner, context.measure)
    : setting.size;
  return grownTextBlock(words, inner, 0, styleOf(size, weight, color), context.measure, {
    name,
    align: 'center',
    lineHeight: LINE_HEIGHT,
    overflow: 'grow',
  });
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
