/**
 * `anuncio` — a performance remarketing ad for one exam: the exam's facts at the head and an
 * offer below, in a feed post (1080×1350) and a story (1080×1920).
 *
 * The brief writes the exam once (`::concurso`) and one `::versao` per artwork: the offer
 * version and the timeless one are two occurrences of the same repeating slot, so one brief
 * draws the four boards of the reference PSDs (two versions × two formats).
 *
 * The head's layout (`cabeca`) and the offer's (`oferta`) are enum slots, so each of the named
 * variants (`vitrine-cartao`, `faixa-lista`…) is a configuration of the plugin file that
 * defaults them (Tyto ADR 0151, TYTO-440). **This first composition draws neither yet**: it
 * places the slots' words in their boxes, the logo above them, and reports when the words
 * outgrow the page. The layouts arrive with the kit pieces they consume (TYTO-797 to 801).
 *
 * The logo is the brand kit's (Tyto ADR 0063), a placeholder without one; every colour is a
 * declared value (Tyto ADR 0153).
 */

import { colorValue, frame, solid } from '@tyto/core/template';
import { drawLogo, oneInk } from '@tyto/house-style';
import { at, grownTextBlock, reportOverflow } from '@tyto/template-kit';

import type { RichText, TemplateBuild, TemplateContext } from '@tyto/core';

/** The colours, by declared value name. Placeholders until the art is built against the PSDs. */
export const COLOR_DEFAULTS = {
  accent: '#1f4fa3',
  paper: '#ffffff',
  ink: '#1a1a1a',
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;

const FACE = { family: 'CircularXX', source: 'system' } as const;
const REGULAR = 400;
const BOLD = 700;

/** The page's side margins and the logo's place, in the frame's pixels. */
export const MARGIN = 80;
const LOGO_TOP = 80;
const LOGO_HEIGHT = 64;

/** Where the exam's facts start, and the room between them and the offer. */
const HEAD_TOP = 220;
const OFFER_GAP = 64;

/** The lowest any word may end: the page's foot less the margin. */
function limitOf(height: number): number {
  return height - MARGIN;
}

const EMPTY: RichText = [];

/** A rich-text slot's words, or nothing when the brief left it out. */
export function wordsOf(context: TemplateContext, name: string): RichText {
  const value = context.slots[name]?.value;
  return value?.kind === 'rich-text' ? value.text : EMPTY;
}

export const build: TemplateBuild = (context: TemplateContext) => {
  const ink = (name: ColorName): string => colorValue(context, name, COLOR_DEFAULTS[name]);
  const width = context.size.w - 2 * MARGIN;

  const head = grownTextBlock(
    wordsOf(context, 'concurso'),
    width,
    0,
    { font: FACE, size: 44, weight: BOLD, color: ink('ink') },
    context.measure,
  );
  const offerTop = HEAD_TOP + head.height + OFFER_GAP;
  const offer = grownTextBlock(
    wordsOf(context, 'versao'),
    width,
    0,
    { font: FACE, size: 36, weight: REGULAR, color: ink('accent') },
    context.measure,
  );

  reportOverflow(context.report, offerTop + offer.height, limitOf(context.size.h));

  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid(ink('paper')),
    children: [
      at(MARGIN, LOGO_TOP, drawLogo(context.brand, LOGO_HEIGHT, oneInk(ink('accent')))),
      at(MARGIN, HEAD_TOP, head),
      at(MARGIN, offerTop, offer),
    ],
  });
};
