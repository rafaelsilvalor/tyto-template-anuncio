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
 * (Tyto ADR 0151, TYTO-440). **Two heads are drawn so far, `vitrine` and `faixa` (TYTO-848),
 * and two offers, `cartao` and `impacto` (TYTO-850)**, whatever the slots say; the other layouts arrive one at a time.
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
 * The logo is the brand kit's (Tyto ADR 0063), a placeholder without one, with the kit's
 * wordmark beside it when the kit has one (ADR 0066). The panel carries the kit's background
 * pattern when it has one (ADR 0228), faint and cut to the panel. Every colour is a declared
 * value (Tyto ADR 0153); the pattern takes `destaque` and `texto`, so it follows the brief.
 */

import {
  colorValue,
  contrastRatio,
  frame,
  group,
  image,
  numberValue,
  rect,
  solid,
} from '@tyto/core/template';
import { drawBrandMark, drawLogo, drawPattern, oneInk } from '@tyto/house-style';
import {
  at,
  block,
  blockColumn,
  entriesInOrder,
  bodyBlock,
  card as drawCard,
  cardSegments,
  grownTextBlock,
  highlights,
  inset,
  levelStack,
  levelsOf,
  mainLineScale,
  naturalWidth,
  parameterValues,
  plain,
  reportOverflow,
  row,
  scalesOf,
  stack,
} from '@tyto/template-kit';

import type { Inline, RichText, TemplateBuild, TemplateContext } from '@tyto/core';
import type { NodeDraft } from '@tyto/core/template';
import type {
  Area,
  Level,
  Block,
  CardRole,
  BlockOfKind,
  ColumnEntry,
  LevelItem,
  LevelLook,
  LevelPart,
  Highlights,
  ParameterSchema,
  TextStyle,
} from '@tyto/template-kit';

/* ------------------------------------------------------------------------- the tokens -- */

/**
 * The colours, by declared value name, each default the reference's. Named in the brief writer's
 * language, since a brief's frontmatter sets them (Tyto ADR 0226): `destaque: '#e30613'`.
 */
export const COLOR_DEFAULTS = {
  /** The exam's name, the accent levels, the card's outline and its band. */
  destaque: '#1363d0',
  /**
   * A second and a third highlight, painted only where a `{cor:…}` mark names them (TYTO-847):
   * the name in `destaque` and the price in `destaque-2`. A declared colour needs a constant
   * default, so theirs is `destaque`'s, and a brief that marks them sets them.
   */
  'destaque-2': '#1363d0',
  'destaque-3': '#1363d0',
  /** The panel under the words. */
  fundo: '#f7f4f4',
  /** Every word on the panel. */
  texto: '#4d4d4d',
  /** The words on the band. */
  'texto-faixa': '#eceaea',
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;

/** One placed block's value, as `context.order` carries it (Tyto ADR 0227). */
type BlockSlot = Parameters<BlockOfKind>[0];

/**
 * The least contrast a pair of colours the template draws words in may have before it warns
 * (TYTO-836). Both pairs set large Black words, the exam's name and the band, so the floor is
 * WCAG 2's for large text, 3:1, not 4.5:1: at 4.5 the house red #e30613 would warn on both pairs
 * (4.1 and 4.5) though it reads well, while yellow (1.4) and a mid green (2.6) still warn at 3.
 */
export const CONTRAST_FLOOR = 3;

/** The pairs checked, words on their ground: the band's words, and the name on the panel. */
const CONTRAST_PAIRS: readonly (readonly [ColorName, ColorName])[] = [
  ['texto-faixa', 'destaque'],
  ['destaque', 'fundo'],
];

/** Every colour name a `{cor:…}` mark names anywhere in a value, the brief's or a nested one. */
function markedColors(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) markedColors(item, found);
  } else if (typeof value === 'object' && value !== null) {
    const node = value as { kind?: unknown; key?: unknown; value?: unknown };
    if (node.kind === 'mark' && node.key === COLOR_MARK && typeof node.value === 'string') {
      found.add(node.value);
    }
    for (const child of Object.values(value)) markedColors(child, found);
  }
  return found;
}

/**
 * One warning per pair under the floor; the colours stay as the brief chose them. A colour a
 * `{cor:…}` mark paints on the panel (the head, the body, the note) is checked against `fundo`
 * too; the offer's words sit on the card and the band, and are not.
 */
function reportContrast(context: TemplateContext, ink: Ink): void {
  const marked = markedColors(
    (['titulo', 'corpo', 'nota'] as const).map((name) => context.slots[name]),
  );
  const pairs = [
    ...CONTRAST_PAIRS,
    ...[...marked]
      .filter((name): name is ColorName => name in COLOR_DEFAULTS && name !== 'destaque')
      .map((name) => [name, 'fundo'] as const),
  ];
  for (const [words, ground] of pairs) {
    const foreground = ink(words);
    const background = ink(ground);
    const ratio = contrastRatio(foreground, background);
    // A colour that is no hex (a named colour a configuration chose) has no ratio, and no warning.
    if (ratio !== undefined && ratio < CONTRAST_FLOOR) {
      context.report({ code: 'W_TEMPLATE_LOW_CONTRAST', foreground, background, ratio });
    }
  }
}
type Ink = (name: ColorName) => string;

/** Each declared colour as the brief, its configuration or the default sets it (ADR 0153, 0226). */
function inkOf(context: TemplateContext): Ink {
  return (name) => colorValue(context, name, COLOR_DEFAULTS[name]);
}

/** The mark family that paints a span: `{cor:destaque}R$ 16 mil{/}` (TYTO-846). */
const COLOR_MARK = 'cor';

/**
 * What `{cor:<name>}…{/}` paints: each declared colour, by its name. **Colour only**: a level
 * keeps its own weight, so a span inside a Black name stays Black and one inside a Light line
 * stays Light; `**…**` around or inside it makes it heavier. A name the template does not
 * declare leaves the words in their level's colour, as a mark nothing maps always has.
 */
function colorMarks(ink: Ink): Highlights {
  const values: Record<string, { readonly color: string }> = {};
  for (const name of Object.keys(COLOR_DEFAULTS) as ColorName[])
    values[name] = { color: ink(name) };
  return highlights({ marks: { [COLOR_MARK]: { like: 'plain', values } } });
}

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
  /**
   * Between two lines a blank line separates in the brief (ADR 0205, TYTO-845): the name's own
   * gap, the larger room the reference already opens, so a paragraph reads as a new group.
   */
  readonly paragraphGap: number;
  /** The card's box; its band spans the card's width. */
  readonly card: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly band: { readonly y: number; readonly h: number };
  readonly title: Spot;
  readonly bandText: Spot;
  readonly foot: Spot;
  readonly proof: Spot;
  readonly logo: { readonly top: number; readonly height: number };
  /** The kit's wordmark beside the logo: its height and the room between them, centred. */
  readonly wordmark: { readonly height: number; readonly gap: number };
  /** The offer card's corner radius: rounded under the vitrine head, square under the faixa. */
  readonly cardRadius: number;
  /** Whether the card's band casts the reference's shadow: the vitrine's does, the faixa's not. */
  readonly bandShadow: boolean;
  /**
   * How far the name may grow past its reference size to fill the width; absent, the kit's
   * default. The faixa sets its name at the reference size and only shrinks it (TYTO-848).
   */
  readonly nameMaxScale?: number;
  /** The impacto offer's sizes and room (TYTO-850). */
  readonly impacto: ImpactoShape;
  /**
   * The room between the head or the body and the next block, over the `headGap` parameter;
   * absent, the parameter's. The faixa sets its own, measured on its reference (TYTO-852).
   */
  readonly headGap?: number;
}

/**
 * The impacto offer (TYTO-850), measured on the PM SC boards (`1350_v1`, `1920_v1`): a block in
 * `destaque` holding the discount's figure at a giant size, its `%` over its unit beside it, a
 * rule, and the words after the discount stacked on the right; the words before it centred
 * above the block. Sizes are font sizes, the room is box to box.
 */
interface ImpactoShape {
  readonly figure: number;
  readonly percent: number;
  readonly unit: number;
  /** Between the `%` and the unit under it. */
  readonly unitGap: number;
  readonly side: number;
  /** The side's line advance, as a multiple of its size. */
  readonly sideLineHeight: number;
  readonly rule: number;
  /** Figure to `%`, `%` to the rule, the rule to the side. */
  readonly gaps: { readonly unit: number; readonly rule: number; readonly side: number };
  /** Inside the block: above and below, left and right. */
  readonly padding: { readonly block: number; readonly inline: number };
  readonly title: number;
  readonly titleGap: number;
}

/**
 * The faixa head (TYTO-848), measured on the DETRAN SP boards: the photograph framed with
 * rounded corners under the lockup, a strip in `destaque` under it holding the status line, and
 * the column below on the plain ground, between `columnTop` and `columnBottom`.
 */
interface FaixaShape {
  /** The photograph's frame, left and right margin alike. */
  readonly margin: number;
  readonly photoTop: number;
  readonly photoBottom: number;
  /** The strip runs from under the photograph to here; the photograph's corners round it. */
  readonly stripBottom: number;
  readonly radius: number;
  /** The status words in the strip: light capitals, centred. */
  readonly status: { readonly size: number };
  readonly columnTop: number;
  readonly columnBottom: number;
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
  // 15, not 29: the reference's status sits 25 px of ink over the name (TYTO-852).
  partGap: 15,
  nameGap: 35.6,
  lineGap: 15.5,
  paragraphGap: 35.6,
  card: { x: 142, y: 872, w: 796, h: 266 },
  band: { y: 948, h: 117 },
  title: { capTop: 891, size: 50 },
  bandText: { capTop: 983, size: 60.3 },
  foot: { capTop: 1084, size: 33.6 },
  proof: { capTop: 1171, size: 33.3 },
  logo: { top: 1245, height: 62 },
  wordmark: { height: 49.5, gap: 13 },
  cardRadius: 39,
  bandShadow: true,
  impacto: {
    figure: 140,
    percent: 82,
    unit: 39,
    unitGap: 4,
    side: 61,
    sideLineHeight: 1.08,
    rule: 6,
    gaps: { unit: 6, rule: 15, side: 17 },
    padding: { block: 28, inline: 41 },
    title: 36,
    titleGap: 36,
  },
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
  // 20, not 32: the reference's 29 px of ink between the status and the name (TYTO-852).
  partGap: 20,
  nameGap: 65,
  lineGap: 30,
  paragraphGap: 65,
  card: { x: 105, y: 1263, w: 870, h: 290 },
  band: { y: 1347, h: 127 },
  title: { capTop: 1283, size: 54.7 },
  bandText: { capTop: 1384, size: 66 },
  foot: { capTop: 1495, size: 36.8 },
  proof: { capTop: 1590, size: 36.5 },
  logo: { top: 1687, height: 71 },
  wordmark: { height: 57, gap: 16 },
  cardRadius: 39,
  bandShadow: true,
  impacto: {
    figure: 192,
    percent: 112,
    unit: 53,
    unitGap: 5,
    side: 84,
    sideLineHeight: 1.08,
    rule: 7,
    gaps: { unit: 6, rule: 21, side: 25 },
    padding: { block: 38, inline: 54 },
    title: 36,
    titleGap: 57,
  },
};

/**
 * The faixa head's feed post, board `1350_v2` of the DETRAN SP reference: name 88 px Black, the
 * card 828 px wide with square corners, the lockup at the top (TYTO-848).
 */
export const FAIXA_GRID: Geometry & { readonly faixa: FaixaShape } = {
  ...GRID,
  name: { capTop: 716, size: 88 },
  card: { x: 125, y: 1023, w: 828, h: 218 },
  band: { y: 1083, h: 95 },
  title: { capTop: 1042, size: 40 },
  foot: { capTop: 1189, size: 32 },
  proof: { capTop: 1259, size: 30 },
  logo: { top: 41, height: 54 },
  wordmark: { height: 43, gap: 11 },
  // The DETRAN SP feed's room, ink to ink (TYTO-852): name to the next line 37, two supporting
  // lines 11, a blank line's room 32, the body to the card 43, the card to the note 22.
  nameGap: 16.6,
  lineGap: 9.5,
  paragraphGap: 22.6,
  headGap: 38,
  proofGap: 21,
  cardRadius: 0,
  bandShadow: false,
  nameMaxScale: 1,
  faixa: {
    margin: 59,
    photoTop: 126,
    photoBottom: 626,
    stripBottom: 684,
    radius: 60,
    status: { size: 40 },
    columnTop: 715,
    columnBottom: 1300,
  },
};

/** The faixa head's story, board `1920_v2`: name 110.6 px, the card 898 px wide (TYTO-848). */
export const FAIXA_STORY: Geometry & { readonly faixa: FaixaShape } = {
  ...STORY,
  name: { capTop: 974, size: 110.6 },
  card: { x: 90, y: 1410, w: 898, h: 235 },
  band: { y: 1474, h: 104 },
  title: { capTop: 1430, size: 43.4 },
  foot: { capTop: 1590, size: 34.8 },
  proof: { capTop: 1666, size: 32.6 },
  logo: { top: 72, height: 54 },
  wordmark: { height: 43, gap: 11 },
  // The DETRAN SP story's room, ink to ink (TYTO-852): name to the next line 46, two supporting
  // lines 13, a blank line's room 62, the body to the card 81, the card to the note 23.
  nameGap: 17,
  lineGap: 10,
  paragraphGap: 39,
  headGap: 74,
  proofGap: 22,
  cardRadius: 0,
  bandShadow: false,
  nameMaxScale: 1,
  faixa: {
    margin: 58,
    photoTop: 157,
    photoBottom: 877,
    stripBottom: 934,
    radius: 60,
    status: { size: 40 },
    columnTop: 971,
    columnBottom: 1830,
  },
};

/**
 * The kit's pattern as the reference lays it (`Malha`, TYTO-844), the same in both formats: a
 * tile 336 px wide, at 8%, registered to the frame rather than the panel — a tile corner sits
 * at x 40 and at y 217 modulo 336, on the feed post (553) and on the story (890) alike — so the
 * lattice stays put when a long head raises the panel.
 */
export const PATTERN = { tileWidth: 336, corner: { x: 40, y: 217 }, opacity: 0.08 } as const;

/**
 * The format's geometry with the brief's spacing laid over it (TYTO-845): `respiro` multiplies
 * the room a blank line opens and `espaco-partes` the room between two parts of one line, the
 * status above the exam's name among them. Both default to 1, which draws the reference.
 */
export const SPACING_DEFAULTS = { respiro: 1, 'espaco-partes': 1 } as const;

function spaced(context: TemplateContext, geometry: Geometry): Geometry {
  return {
    ...geometry,
    partGap:
      geometry.partGap * numberValue(context, 'espaco-partes', SPACING_DEFAULTS['espaco-partes']),
    paragraphGap: geometry.paragraphGap * numberValue(context, 'respiro', SPACING_DEFAULTS.respiro),
  };
}

/** A frame taller than one and a half times its width is laid out as the story. */
export function geometryOf(size: { readonly w: number; readonly h: number }): Geometry {
  return size.h / size.w > 1.5 ? STORY : GRID;
}

/** The faixa head's geometry for a frame, by the same rule. */
export function faixaGeometryOf(size: {
  readonly w: number;
  readonly h: number;
}): Geometry & { readonly faixa: FaixaShape } {
  return size.h / size.w > 1.5 ? FAIXA_STORY : FAIXA_GRID;
}

/** The offer's layout the brief or the configuration chose; `cartao` and `impacto` are drawn. */
function offerLayout(context: TemplateContext): string {
  const value = context.slots['oferta']?.value;
  return value?.kind === 'enum' ? value.value : 'cartao';
}

/** The head's layout the brief or the configuration chose; only `faixa` and `vitrine` are drawn. */
function headLayout(context: TemplateContext): string {
  const value = context.slots['cabeca']?.value;
  return value?.kind === 'enum' ? value.value : 'vitrine';
}

/** The panel's side margin for every text, and the card's inner margin for its words. */
export const TEXT_MARGIN = 60;
const CARD_PADDING = 48;
/** The smallest a card's line shrinks to before it wraps instead. */
const FIT_FLOOR = 0.7;
/** The photograph's stand-in when the brief names none. */
const NO_PHOTO = '#c9ccd2';
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
  const ink = inkOf(context);
  const faixaGeometry = headLayout(context) === 'faixa' ? faixaGeometryOf(context.size) : undefined;
  const faixa = faixaGeometry?.faixa;
  const geometry = spaced(context, faixaGeometry ?? geometryOf(context.size));
  const values = parameterValues(ANUNCIO_PARAMETERS);

  // The faixa's column sits under the strip, down to the foot, and never raises the photograph.
  const top = faixa === undefined ? geometry.panelTop + geometry.panelPadding : faixa.columnTop;
  const area = {
    width: context.size.w - 2 * TEXT_MARGIN,
    height:
      faixa === undefined
        ? geometry.logo.top - values.noteGap - top
        : faixa.columnBottom - faixa.columnTop,
  };
  const reach =
    faixa === undefined ? Math.max(0, geometry.panelTop - context.size.h * values.photoShare) : 0;

  // One column entry per block the brief placed (Tyto ADR 0227, TYTO-840): two `::corpo`, or a
  // shared title and a slide's own, are two blocks, each from its own words at its own `peso`.
  const textOf = (slot: BlockSlot): RichText =>
    slot.value.kind === 'rich-text' ? slot.value.text : EMPTY;
  // Under the faixa, the parts before the name in the first title's first line go in the strip
  // (TYTO-848): the first title the artwork draws, found by where its words start in the brief.
  const firstTitle =
    context.order?.find((entry) => entry.name === 'titulo' && entry.slot !== undefined)?.slot ??
    context.slots['titulo'];
  const statusOf =
    faixa === undefined || firstTitle === undefined
      ? undefined
      : takeStatus(levelsOf(textOf(firstTitle)));
  const startOf = (text: RichText): number | undefined => text[0]?.range.start;
  const kinds: Record<string, BlockOfKind> = {
    titulo: (slot) => {
      const read = levelsOf(textOf(slot));
      const items =
        statusOf !== undefined &&
        firstTitle !== undefined &&
        startOf(textOf(slot)) === startOf(textOf(firstTitle))
          ? statusOf.items
          : read;
      return {
        ...scalesOf(slot),
        build: (room, scale, spacing = scale) =>
          head(context, ink, geometry, items, room, scale, spacing, values.headShare),
      };
    },
    corpo: (slot) => {
      const words = textOf(slot);
      return {
        ...scalesOf(slot),
        build: (room, scale, spacing = scale) =>
          body(context, ink, geometry, words, room, scale, spacing),
      };
    },
    apelo: (slot) => {
      const items = levelsOf(textOf(slot));
      return {
        ...scalesOf(slot),
        // An impacto whose main part is no figure falls back to the card, so no brief breaks.
        build: (room, scale, spacing = scale) =>
          (offerLayout(context) === 'impacto'
            ? impacto(context, ink, geometry, items, room.width, scale, spacing)
            : undefined) ??
          offer(context, ink, geometry, items, scale, spacing, values.segmentPadding * spacing),
      };
    },
    nota: (slot) => {
      const words = textOf(slot);
      // The note is one text with no space inside it: `espaco` has nothing to scale there.
      return {
        ...scalesOf(slot),
        build: (room, scale) => note(context, ink, geometry, words, room, scale),
      };
    },
  };
  // A context built without values (a test by hand) reads one value per slot, as before.
  const fallback: ColumnEntry[] = (['titulo', 'corpo', 'apelo', 'nota'] as const).map((name) => {
    const slot = context.slots[name];
    const built = slot === undefined ? undefined : kinds[name]?.(slot);
    return {
      name,
      build: built?.build ?? (() => undefined),
      scale: built?.scale ?? 1,
      ...(built?.spacing === undefined ? {} : { spacing: built.spacing }),
      ...(built?.distance === undefined ? {} : { distance: built.distance }),
    };
  });
  const column = blockColumn(area, {
    name: 'coluna',
    entries: entriesInOrder(context.order, kinds, fallback),
    gapBetween: (above, below) => {
      // The body reads as the head's continuation: under the name it keeps the name's own gap,
      // and so does a second block of the head's own kind.
      if (above === 'titulo' && below === 'corpo') return geometry.nameGap;
      if (above === below && (above === 'titulo' || above === 'corpo')) return geometry.nameGap;
      const isHead = (name: string): boolean => name === 'titulo' || name === 'corpo';
      return isHead(above) || isHead(below)
        ? (geometry.headGap ?? values.headGap)
        : geometry.proofGap;
    },
    // The faixa's column starts under the strip, the name where the reference sets it.
    parameters: faixa === undefined ? { reach } : { reach, verticalAlign: 'start' },
  });
  reportOverflow(context.report, column.overflow, 0);
  reportContrast(context, ink);

  if (faixa !== undefined) {
    return faixaFrame(context, ink, geometry, faixa, statusOf?.status, column.block, top);
  }

  const panelTop = geometry.panelTop - column.rise;
  const logo = lockup(context, geometry, ink('destaque'));
  const panelId = `${context.idPrefix}.painel`;
  const panelSize = { w: context.size.w, h: context.size.h - panelTop };
  const pattern = drawPattern(context.brand, {
    size: panelSize,
    tileWidth: PATTERN.tileWidth,
    inks: { primary: ink('destaque'), secondary: ink('texto') },
    opacity: PATTERN.opacity,
    mask: { nodeId: panelId, mode: 'alpha' },
    phase: { x: PATTERN.corner.x, y: PATTERN.corner.y - panelTop },
  });

  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid(ink('fundo')),
    children: [
      photo(context, geometry),
      rect({
        // Named only when a pattern is masked by it: an explicit id changes the HTML's ids, and
        // a render without a kit keeps its bytes.
        ...(pattern === undefined ? {} : { id: panelId }),
        name: 'painel',
        size: panelSize,
        radius: [geometry.panelRadius, geometry.panelRadius, 0, 0],
        fill: solid(ink('fundo')),
        transform: { y: panelTop },
      }),
      ...(pattern === undefined ? [] : [at(0, panelTop, pattern)]),
      at(TEXT_MARGIN, top - column.rise, column.block),
      at((context.size.w - logo.width) / 2, geometry.logo.top, logo),
    ],
  });
};

/**
 * The kit's logo, and its wordmark beside it when the kit has one, centred on each other as the
 * reference sets them, all in one ink. Without a wordmark it is the logo alone, as before.
 */
function lockup(context: TemplateContext, geometry: Geometry, color: string): Block {
  const inks = oneInk(color);
  const logo = drawLogo(context.brand, geometry.logo.height, inks);
  const wordmark = context.brand.wordmark;
  if (wordmark === undefined) return logo;
  return row({
    name: 'assinatura',
    items: [logo, drawBrandMark(wordmark, geometry.wordmark.height, inks, 'wordmark')],
    gap: geometry.wordmark.gap,
    align: 'center',
  });
}

/**
 * A title's first line with the parts before its name taken out, and those parts as the faixa's
 * status (TYTO-848). A first line that was only those parts is dropped; one with none leaves the
 * items as they were and no status.
 */
function takeStatus(items: readonly LevelItem[]): {
  readonly items: readonly LevelItem[];
  readonly status: RichText | undefined;
} {
  const [first, ...rest] = items;
  if (first === undefined || first.kind !== 'line') return { items, status: undefined };
  // A piece joined to the name by a typed break is part of the name's `|` part, so it stays
  // with the name: the strip takes only the parts before that one (TYTO-855, Tyto ADR 0229).
  const main = first.parts.findIndex((part) => part.position === 'main');
  let nameStart = main < 0 ? first.parts.length : main;
  while (nameStart > 0 && first.parts[nameStart]?.joined === true) nameStart -= 1;
  const before = first.parts.slice(0, nameStart);
  if (before.length === 0) return { items, status: undefined };
  const kept = first.parts.slice(nameStart);
  const status = before.flatMap((part, index): Inline[] => {
    if (index === 0) return [...part.words];
    const start = part.words[0]?.range.start ?? 0;
    return [{ kind: 'text', value: ' ', range: { start, end: start } }, ...part.words];
  });
  const line: LevelItem[] = kept.length === 0 ? [] : [{ ...first, parts: kept }];
  return { items: [...line, ...rest], status };
}

/**
 * The faixa head's frame (TYTO-848): the lockup at the top, the photograph framed with rounded
 * corners over a strip in `destaque` that holds the status, and the column below on the plain
 * ground. No pattern: the reference has none.
 */
function faixaFrame(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  faixa: FaixaShape,
  status: RichText | undefined,
  column: Block,
  top: number,
) {
  const width = context.size.w - 2 * faixa.margin;
  const photoSize = { w: width, h: faixa.photoBottom - faixa.photoTop };
  const frameId = `${context.idPrefix}.moldura`;
  const value = context.slots['imagem']?.value;
  const picture: NodeDraft =
    value?.kind === 'image'
      ? image({
          name: 'imagem',
          asset: value.asset,
          size: photoSize,
          fit: 'cover',
          mask: { nodeId: frameId, mode: 'alpha' },
          transform: { x: faixa.margin, y: faixa.photoTop },
        })
      : rect({
          name: 'imagem',
          size: photoSize,
          radius: faixa.radius,
          fill: solid(NO_PHOTO),
          transform: { x: faixa.margin, y: faixa.photoTop },
        });
  const stripHeight = faixa.stripBottom - faixa.photoBottom;
  const words =
    status === undefined
      ? undefined
      : grownTextBlock(
          upper(status),
          width,
          0,
          styleOf(faixa.status.size, LIGHT, ink('texto-faixa'), ink),
          context.measure,
          { name: 'status', align: 'center', lineHeight: LINE_HEIGHT, overflow: 'grow' },
        );
  const logo = lockup(context, geometry, ink('destaque'));

  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid(ink('fundo')),
    children: [
      // The strip only holds a status: with none, the photograph stands alone, as on PM SC.
      ...(words === undefined
        ? []
        : [
            rect({
              // Not `faixa`: the card's band already carries that name.
              name: 'tarja',
              size: { w: width, h: faixa.stripBottom - faixa.photoTop },
              radius: faixa.radius,
              fill: solid(ink('destaque')),
              transform: { x: faixa.margin, y: faixa.photoTop },
            }),
          ]),
      // The photograph's own shape, drawn under it, is what masks it: an image has no radius.
      ...(value?.kind === 'image'
        ? [
            rect({
              id: frameId,
              name: 'moldura',
              size: photoSize,
              radius: faixa.radius,
              fill: solid(ink('destaque')),
              transform: { x: faixa.margin, y: faixa.photoTop },
            }),
          ]
        : []),
      picture,
      ...(words === undefined
        ? []
        : [at(faixa.margin, faixa.photoBottom + (stripHeight - words.height) / 2, words)]),
      at(TEXT_MARGIN, top, column),
      at((context.size.w - logo.width) / 2, geometry.logo.top, logo),
    ],
  });
}

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
  spacing: number,
  headShare: number,
): Block | undefined {
  if (items.length === 0) return undefined;
  const reference = (part: LevelPart): LevelLook => lookOf(part, geometry, ink, 1);
  // `gapRatio` scales the spaces inside the head, `ratio` its letters and its divider.
  const stackAt = (ratio: number, gapRatio: number = ratio): Block =>
    levelStack(
      items,
      {
        name: 'titulo',
        look: (part) => lookOf(part, geometry, ink, ratio),
        gap: geometry.partGap * gapRatio,
        lineGap: (above, below) => lineGapOf(above, below, geometry) * gapRatio,
        divider: () => dots(ink('texto'), ratio),
      },
      room.width,
      context.measure,
    );
  const fill = mainLineScale(
    { width: room.width, height: Infinity },
    {
      items,
      look: reference,
      measure: context.measure,
      parameters: { maxScale: geometry.nameMaxScale ?? Infinity },
    },
  );
  const fitted = mainLineScale(
    { width: room.width, height: room.height * headShare },
    {
      items,
      look: reference,
      measure: context.measure,
      heightAt: (ratio) => stackAt(ratio).height,
      ...(geometry.nameMaxScale === undefined
        ? {}
        : { parameters: { maxScale: geometry.nameMaxScale } }),
    },
  );
  // The letters grow by `tamanho` (or `peso`) up to the width the main line fills; the spaces
  // keep the proportion `espaco` asks of the letters, so with no `espaco` they move together.
  const letters = Math.min(fitted * scale, Math.max(fill, fitted));
  const drawn = stackAt(letters, spacing === scale ? letters : (letters * spacing) / scale);
  return drawn.height > 0 ? drawn : undefined;
}

/**
 * The room under a line: a paragraph's when a blank line opens the next one, else the name's
 * own, larger, or the one every other pair shares.
 */
export function lineGapOf(above: LevelItem, below: LevelItem, geometry: Geometry): number {
  if (below.paragraph === true) return geometry.paragraphGap;
  const holdsName = above.kind === 'line' && above.parts.some((part) => part.level === 1);
  return holdsName ? geometry.nameGap : geometry.lineGap;
}

/** How one level is drawn: its size as a ratio of `#`, its weight, colour and letter spacing. */
export interface LevelStyle {
  readonly ratio: number;
  readonly weight: number;
  readonly color: ColorName;
  /** In em of the level's own size. */
  readonly tracking: number;
  readonly upper: boolean;
}

/**
 * The template's styles per level, the same for the title and the body (maintainer, 2026-11-22,
 * on the specimen sheet): seven styles of the reference art, one per mark. Sizes are ratios of
 * `#`, so they follow the name when it grows or shrinks to fit, and `peso` multiplies them again.
 * The unmarked level is the smallest; `####` to `######` differ by format more than by size,
 * since below about 28 px on a 1080 px frame a line stops reading on a phone.
 */
export const LEVEL_STYLES: Readonly<Record<Level, LevelStyle>> = {
  1: { ratio: 1, weight: BLACK, color: 'destaque', tracking: 0, upper: true },
  2: { ratio: 0.75, weight: MEDIUM, color: 'texto', tracking: 0, upper: false },
  3: { ratio: 0.56, weight: MEDIUM, color: 'texto', tracking: 0, upper: false },
  4: { ratio: 0.48, weight: BLACK, color: 'destaque', tracking: 0, upper: false },
  5: { ratio: 0.48, weight: LIGHT, color: 'texto', tracking: 0, upper: false },
  6: { ratio: 0.44, weight: LIGHT, color: 'destaque', tracking: 0.3, upper: true },
  0: { ratio: 0.4, weight: LIGHT, color: 'texto', tracking: 0, upper: false },
};

/** A part drawn in its level's style at `size`. */
function styled(part: LevelPart, size: number, ink: Ink): LevelLook {
  const style = LEVEL_STYLES[part.level];
  return {
    style: styleOf(size, style.weight, ink(style.color), ink),
    lineHeight: LINE_HEIGHT,
    ...(style.tracking === 0 ? {} : { letterSpacing: size * style.tracking }),
    ...(style.upper ? { transform: upper } : {}),
  };
}

/** What each level of the head looks like at a ratio of the reference: the level table's style. */
function lookOf(part: LevelPart, geometry: Geometry, ink: Ink, ratio: number): LevelLook {
  return styled(part, geometry.name.size * LEVEL_STYLES[part.level].ratio * ratio, ink);
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
  spacing: number,
): Block | undefined {
  const name = geometry.name.size;
  const size = (level: Exclude<Level, 0>): number => name * LEVEL_STYLES[level].ratio;
  // The kit sizes an unmarked line as a share of the smallest level the body uses; the table
  // fixes it at 0.40 of `#`, so the share is worked out from the levels this body writes.
  const used = levelsOf(words, { readByPosition: false }).flatMap((item) =>
    item.kind === 'line' ? item.parts.map((part) => part.level) : [],
  );
  const marked = used.filter((level): level is Exclude<Level, 0> => level !== 0);
  const smallest = Math.min(
    ...(marked.length === 0 ? [1, 2, 3] : marked).map(
      (level) => LEVEL_STYLES[level as Exclude<Level, 0>].ratio,
    ),
  );
  const unmarkedRatio = Math.min(1, LEVEL_STYLES[0].ratio / smallest);
  return bodyBlock(
    room,
    scale,
    {
      words,
      sizes: { 1: size(1), 2: size(2), 3: size(3), 4: size(4), 5: size(5), 6: size(6) },
      look: (part, drawn) => styled(part, drawn, ink),
      measure: context.measure,
      divider: (_width, ratio) => dots(ink('texto'), ratio),
      parameters: { unmarkedRatio, partGap: geometry.partGap, lineGap: geometry.lineGap },
      // A blank line in the body opens a paragraph's room; every other pair keeps the line gap.
      lineGapBetween: (_above, below) =>
        below.paragraph === true ? geometry.paragraphGap : geometry.lineGap,
      name: 'corpo',
    },
    spacing,
  );
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
 * reference's height at the spacing (`espaco`, else `peso`), its words at the scale, centred in
 * it; words that wrap grow their segment. Band and title words shrink to one line before they
 * wrap, down to 0.7. No `::apelo`, no card.
 */
function offer(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  items: readonly LevelItem[],
  scale: number,
  spacing: number,
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
          color: ink('texto-faixa'),
          inner,
          shrink: true,
        });
      case 'title':
        return fitted(context, 'oferta', words(parts), {
          size: geometry.title.size * scale,
          weight: LIGHT,
          color: ink('texto'),
          inner,
          shrink: true,
        });
      case 'foot':
        return fitted(context, 'rodape', words(parts), {
          size: geometry.foot.size * scale,
          weight: LIGHT,
          color: ink('texto'),
          inner,
          shrink: false,
        });
    }
  };
  // A segment's height is its words and the room around them; the room is the card's space, so
  // it follows `espaco`. Words taller than it grow their segment, so nothing is cut.
  const segments = cardSegments(items, segmentOf, {
    title: (band.y - card.y) * spacing,
    band: band.h * spacing,
    foot: (card.y + card.h - band.y - band.h) * spacing,
  });
  if (segments.length === 0) return undefined;
  return drawCard(segments, {
    name: 'cartao',
    width: card.w,
    radius: geometry.cardRadius,
    stroke: { paint: solid(ink('destaque')), width: 2, align: 'inside' },
    band: {
      name: 'faixa',
      fill: solid(ink('destaque')),
      effects: geometry.bandShadow
        ? [
            {
              kind: 'shadow',
              x: 0,
              y: 8,
              blur: 32,
              spread: 0,
              color: { r: 0, g: 0, b: 0, a: 0.35 },
            },
          ]
        : [],
    },
  });
}

/* ------------------------------------------------------------- impacto (TYTO-850) -- */

/** A discount read as a figure, an optional `%` and the words after it: `30% OFF`. */
export function discountOf(
  text: string,
): { readonly figure: string; readonly percent: boolean; readonly unit: string } | undefined {
  const found = /^\s*(\d+(?:[.,]\d+)?)\s*(%?)\s*(.*?)\s*$/u.exec(text);
  if (found === null) return undefined;
  return { figure: found[1]!, percent: found[2] === '%', unit: found[3]! };
}

/**
 * The impacto offer (TYTO-850): the `::apelo`'s first line read as the card reads it, the main
 * part a discount drawn giant in a block of `destaque`, the parts after it stacked beside a rule
 * on the right, the parts before it centred above. `undefined` when the main part is no figure,
 * and the caller draws the card instead.
 */
function impacto(
  context: TemplateContext,
  ink: Ink,
  geometry: Geometry,
  items: readonly LevelItem[],
  width: number,
  scale: number,
  spacing: number,
): Block | undefined {
  const line = items.find((item) => item.kind === 'line');
  if (line === undefined || line.kind !== 'line') return undefined;
  const main = line.parts.find((part) => part.position === 'main');
  if (main === undefined) return undefined;
  const discount = discountOf(plain(main.words));
  if (discount === undefined) return undefined;

  const shape = geometry.impacto;
  const on = ink('texto-faixa');
  const start = main.words[0]?.range.start ?? 0;
  const said = (value: string): RichText => [{ kind: 'text', value, range: { start, end: start } }];
  const piece = (
    name: string,
    words: RichText,
    size: number,
    weight: number,
    color: string,
    lineHeight = LINE_HEIGHT,
  ): Block => {
    const style = styleOf(size, weight, color, ink);
    const natural = naturalWidth(words, style, context.measure) ?? plain(words).length * size * 0.6;
    return grownTextBlock(words, natural, 0, style, context.measure, {
      name,
      align: 'left',
      lineHeight,
      overflow: 'grow',
    });
  };
  const space = (room: number): Block => block(room, 0, group({ name: 'espaco', children: [] }));

  const figure = piece('impacto-numero', said(discount.figure), shape.figure * scale, BLACK, on);
  const unitParts: Block[] = [];
  if (discount.percent) {
    unitParts.push(piece('impacto-porcento', said('%'), shape.percent * scale, BLACK, on));
  }
  if (discount.unit !== '') {
    unitParts.push(
      piece(
        'impacto-unidade',
        said(discount.unit.toLocaleUpperCase('pt-BR')),
        shape.unit * scale,
        BLACK,
        on,
      ),
    );
  }
  const unit =
    unitParts.length === 0
      ? undefined
      : stack({
          name: 'impacto-unidade',
          items: unitParts,
          // As the reference sets them: the `%` from the figure's top, the unit down to its foot.
          gap: Math.max(
            shape.unitGap * spacing,
            figure.height - unitParts.reduce((total, part) => total + part.height, 0),
          ),
        });
  const after = line.parts.filter((part) => part.position === 'after');
  const side =
    after.length === 0
      ? undefined
      : piece(
          'impacto-lado',
          upper(joined(after.map((part) => part.words))),
          shape.side * scale,
          BLACK,
          on,
          shape.sideLineHeight,
        );
  const height = Math.max(figure.height, unit?.height ?? 0, side?.height ?? 0);
  const ruleWidth = shape.rule * scale;
  const items_: Block[] = [figure];
  if (unit !== undefined) items_.push(space(shape.gaps.unit * spacing), unit);
  if (side !== undefined) {
    items_.push(
      space(shape.gaps.rule * spacing),
      block(
        ruleWidth,
        height,
        rect({ name: 'impacto-fio', size: { w: ruleWidth, h: height }, fill: solid(on) }),
      ),
      space(shape.gaps.side * spacing),
      side,
    );
  }
  const content = row({ name: 'impacto-conteudo', align: 'center', items: items_ });
  const padBlock = shape.padding.block * spacing;
  const padInline = shape.padding.inline * spacing;
  const size = { w: content.width + 2 * padInline, h: content.height + 2 * padBlock };
  const panel = block(
    size.w,
    size.h,
    group({
      name: 'impacto',
      children: [
        rect({ name: 'impacto-bloco', size, fill: solid(ink('destaque')) }),
        at(padInline, padBlock, content),
      ],
    }),
  );

  const before = line.parts.filter((part) => part.position === 'before');
  const title =
    before.length === 0
      ? undefined
      : grownTextBlock(
          joined(before.map((part) => part.words)),
          width,
          0,
          styleOf(shape.title * scale, LIGHT, ink('texto'), ink),
          context.measure,
          { name: 'impacto-titulo', align: 'center', lineHeight: LINE_HEIGHT, overflow: 'grow' },
        );
  return stack({
    name: 'oferta-impacto',
    align: 'center',
    gap: shape.titleGap * spacing,
    items: [...(title === undefined ? [] : [title]), panel],
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
  const size = geometry.proof.size * scale;
  // At least one line, as every line of the head and the body: where nothing can measure (a
  // compile with no faces, the tests' own), a note of no height was a block the column dropped
  // (TYTO-858). A measured line is never shorter, so a real render is unchanged.
  return grownTextBlock(
    words,
    room.width,
    size * LINE_HEIGHT,
    styleOf(size, LIGHT, ink('texto'), ink),
    context.measure,
    { name: 'nota', align: 'center', lineHeight: LINE_HEIGHT, overflow: 'grow' },
  );
}

/* ------------------------------------------------------------------ placing words -- */

function styleOf(size: number, weight: number, color: string, ink: Ink): TextStyle {
  return { font: FACE, size, weight, color, highlights: colorMarks(ink) };
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
    ? fitSize(words, setting.size, weight, color, inner, context)
    : setting.size;
  return grownTextBlock(
    words,
    inner,
    0,
    styleOf(size, weight, color, inkOf(context)),
    context.measure,
    {
      name,
      align: 'center',
      lineHeight: LINE_HEIGHT,
      overflow: 'grow',
    },
  );
}

/** The size at which the words fit one line of `width`, never below the floor. */
function fitSize(
  words: RichText,
  size: number,
  weight: number,
  color: string,
  width: number,
  context: TemplateContext,
): number {
  const natural = naturalWidth(
    words,
    styleOf(size, weight, color, inkOf(context)),
    context.measure,
  );
  if (natural === undefined || natural <= width) return size;
  return Math.max(size * FIT_FLOOR, (size * width) / natural);
}
