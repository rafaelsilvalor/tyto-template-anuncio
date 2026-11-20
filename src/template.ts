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

import { colorValue, frame, group, image, rect, solid } from '@tyto/core/template';
import { drawLogo, oneInk } from '@tyto/house-style';
import {
  at,
  block,
  grownTextBlock,
  levelStack,
  levelsOf,
  naturalWidth,
  plain,
  reportOverflow,
  row,
} from '@tyto/template-kit';

import type { Inline, RichText, TemplateBuild, TemplateContext } from '@tyto/core';
import type { NodeDraft } from '@tyto/core/template';
import type {
  Block,
  LevelItem,
  LevelLook,
  LevelPart,
  Measure,
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
/** The least room between the head's last line and the card, the reference's (56 to 57 px). */
const HEAD_GAP = 56;
/** The least room between the note and the logo, the reference's feed post (42 px). */
const PROOF_GAP = 42;
/** The panel never rises above this share of its reference top; past it the head overflows. */
const PANEL_RISE_FLOOR = 0.5;
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

export const build: TemplateBuild = (context: TemplateContext) => {
  const ink: Ink = (name) => colorValue(context, name, COLOR_DEFAULTS[name]);
  const geometry = geometryOf(context.size);

  // Laid out from the bottom up, because the logo is the one thing that never moves: the note
  // sits above the logo, the card above the note, and the head above the card. Each starts at
  // the reference's place and rises only as far as the words under it grew.
  const noteWords = wordsOf(context, 'nota');
  const note =
    plain(noteWords).trim() === ''
      ? undefined
      : centredBlock(context, 'nota', noteWords, geometry.proof, LIGHT, ink('ink'));
  const noteLift = Math.max(0, (note?.bottom ?? 0) + PROOF_GAP - geometry.logo.top);

  const offer = cartao(context, ink, geometry, wordsOf(context, 'apelo'));
  const cardTop = offer.top - noteLift;

  const head = vitrine(context, ink, geometry, wordsOf(context, 'titulo'));
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
      lifted('oferta', offer.nodes, noteLift),
      ...(note === undefined ? [] : [lifted('nota', [note.node], noteLift)]),
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
  const value = context.slots['imagem']?.value;
  if (value?.kind === 'image') {
    return image({ name: 'imagem', asset: value.asset, size, fit: 'cover' });
  }
  return rect({ name: 'imagem', size, fill: solid(NO_PHOTO) });
}

/* ------------------------------------------------------------------- vitrine (head) -- */

interface Head {
  readonly nodes: NodeDraft[];
  /** Where the lowest of its words ends. */
  readonly bottom: number;
}

/**
 * The head: `::titulo`'s lines, ranked by their marks and stacked, from the top of the
 * reference's first line down. A line that wraps pushes the rest down; the build lifts the
 * panel when the stack reaches the card.
 */
function vitrine(context: TemplateContext, ink: Ink, geometry: Geometry, titulo: RichText): Head {
  const width = context.size.w - 2 * TEXT_MARGIN;
  const stacked = levelStack(
    levelsOf(titulo),
    {
      name: 'titulo',
      look: (part) => lookOf(part, geometry, ink),
      gap: geometry.partGap,
      lineGap: (above) => lineGapOf(above, geometry),
      divider: () => dots(ink('ink')),
    },
    width,
    context.measure,
  );
  if (stacked.height === 0) return { nodes: [], bottom: 0 };
  const top = geometry.kicker.capTop - capOffset(geometry.kicker.size);
  return { nodes: [at(TEXT_MARGIN, top, stacked)], bottom: top + stacked.height };
}

/** The room under a line: the name's own, larger, or the one every other pair shares. */
export function lineGapOf(above: LevelItem, geometry: Geometry): number {
  const holdsName = above.kind === 'line' && above.parts.some((part) => part.level === 1);
  return holdsName ? geometry.nameGap : geometry.lineGap;
}

/**
 * What each level of the head looks like: `#` the exam's name, in capitals and the accent;
 * `##` before it the status line, after it the salary; `###` a supporting line in Medium; the
 * base level a supporting line, or, before the name, a tracked label in the accent.
 */
function lookOf(part: LevelPart, geometry: Geometry, ink: Ink): LevelLook {
  const look = (spot: Spot, weight: number, color: string): LevelLook => ({
    style: styleOf(spot.size, weight, color),
    lineHeight: LINE_HEIGHT,
  });
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
            ...look(geometry.support, LIGHT, ink('accent')),
            letterSpacing: geometry.support.size * TRACKING,
            transform: upper,
          }
        : look(geometry.support, LIGHT, ink('ink'));
  }
}

/** The divider: three dots, centred. */
function dots(color: string): Block {
  const dot = (): Block =>
    block(
      DOT,
      DOT,
      rect({ name: 'ponto', size: { w: DOT, h: DOT }, radius: DOT / 2, fill: solid(color) }),
    );
  return row({ name: 'divisor', items: [dot(), dot(), dot()], gap: DOT_GAP });
}

/* ------------------------------------------------------------------- cartao (offer) -- */

interface Offer {
  readonly nodes: NodeDraft[];
  /** Where the card's top edge sits; the reference's when there is no card. */
  readonly top: number;
}

/**
 * The offer as a card shaped by `::apelo`'s parts: the main part is the band, the parts before
 * it the title, the parts after it the foot (later lines join the foot). A segment absent
 * leaves the band at that edge, and the band takes that edge's corners. A title that wraps
 * grows the card upward. Band words that wrap past the shrink floor grow the band upward by
 * their extra lines, words kept centred in it, and the title and the card's top rise with it;
 * the band's bottom edge, the foot and everything under them stay (TYTO-811). No `::apelo`,
 * no card.
 */
function cartao(context: TemplateContext, ink: Ink, geometry: Geometry, apelo: RichText): Offer {
  const { card, band } = geometry;
  const parts = levelsOf(apelo).flatMap((item) => (item.kind === 'line' ? item.parts : []));
  const main = parts.findIndex((part) => part.position === 'main');
  if (main < 0) return { nodes: [], top: card.y };

  const inner = card.w - 2 * CARD_PADDING;
  const titleWords = joined(parts.slice(0, main).map((part) => part.words));
  const footWords = joined(parts.slice(main + 1).map((part) => part.words));
  const hasTitle = plain(titleWords).trim() !== '';
  const hasFoot = plain(footWords).trim() !== '';

  const bandWords = fitted(
    context,
    'faixa-texto',
    parts[main]!.words,
    geometry.bandText,
    BLACK,
    ink('on-accent'),
    card,
    inner,
    true,
  );
  const bandGrowth = bandWords.extra;
  const bandTop = band.y - bandGrowth;

  const words: NodeDraft[] = [];
  let growth = 0;
  if (hasTitle) {
    const placed = fitted(
      context,
      'oferta',
      titleWords,
      geometry.title,
      LIGHT,
      ink('ink'),
      card,
      inner,
      true,
      bandGrowth,
    );
    growth = placed.extra;
    words.push(placed.node);
  }
  words.push(bandWords.node);
  if (hasFoot) {
    words.push(
      fitted(context, 'rodape', footWords, geometry.foot, LIGHT, ink('ink'), card, inner).node,
    );
  }

  const top = (hasTitle ? card.y - growth : band.y) - bandGrowth;
  const bottom = hasFoot ? card.y + card.h : band.y + band.h;
  const corner = (rounded: boolean) => (rounded ? CARD_RADIUS : 0);
  const nodes: NodeDraft[] = [
    rect({
      name: 'cartao',
      size: { w: card.w, h: bottom - top },
      radius: CARD_RADIUS,
      stroke: { paint: solid(ink('accent')), width: 2, align: 'inside' },
      transform: { x: card.x, y: top },
    }),
    rect({
      name: 'faixa',
      size: { w: card.w, h: band.h + bandGrowth },
      radius: [corner(!hasTitle), corner(!hasTitle), corner(!hasFoot), corner(!hasFoot)],
      fill: solid(ink('accent')),
      effects: [
        { kind: 'shadow', x: 0, y: 8, blur: 32, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.35 } },
      ],
      transform: { x: card.x, y: bandTop },
    }),
    ...words,
  ];
  return { nodes, top };
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
  const shown = grownTextBlock(
    words,
    width,
    0,
    styleOf(spot.size, weight, color),
    context.measure,
    { name, align: 'center', lineHeight: LINE_HEIGHT, overflow: 'grow' },
  );
  const top = spot.capTop - capOffset(spot.size);
  return { node: at(TEXT_MARGIN, top, shown), bottom: top + shown.height };
}

/**
 * Words centred in the card, shrunk to one line when they are wider than its inside, and
 * wrapped past the floor. `extra` is how much taller than one line they came out; growing up,
 * the last line keeps the reference's place and the lines before it rise.
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
  /** How far everything under these words grew upward: the words rise by it too. */
  raise = 0,
): { node: NodeDraft; extra: number } {
  const size = fitSize(words, spot.size, weight, color, inner, context.measure);
  const shown = grownTextBlock(words, inner, 0, styleOf(size, weight, color), context.measure, {
    name,
    align: 'center',
    lineHeight: LINE_HEIGHT,
    overflow: 'grow',
  });
  // A shrunk line keeps the centre of the reference's line, not its top.
  const capTop = spot.capTop + (CAP_HEIGHT * (spot.size - size)) / 2;
  const extra = Math.max(0, shown.height - size * LINE_HEIGHT);
  const top = capTop - capOffset(size) - (growUp ? extra : 0) - raise;
  return { node: at(card.x + CARD_PADDING, top, shown), extra };
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
