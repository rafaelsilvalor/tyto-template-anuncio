import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { COLOR_DEFAULTS, CONTRAST_FLOOR, build } from '../src/template.js';

import type { SuppliedValues } from '@tyto/core';

/**
 * What a configuration may change in `anuncio` (Tyto ADR 0153): each declared default pinned
 * to the constant the code falls back to, and a value set here found in the HTML.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const compiled = async (values?: SuppliedValues) => {
  const result = await compileTemplate({
    brief: read('../templates/anuncio/examples/duas-versoes.brief').replace(
      'formats: [grid, story]',
      'formats: [grid]',
    ),
    template,
    formats,
    ...(values === undefined ? {} : { values }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result;
};

const contrastWarnings = async (values?: SuppliedValues): Promise<string[]> =>
  (await compiled(values)).diagnostics
    .filter((item) => item.code === 'W_TEMPLATE_LOW_CONTRAST')
    .map((item) => item.message);

const html = async (values?: SuppliedValues): Promise<string> =>
  (await compiled(values)).value.frames[0]!.html;

describe('declared values', () => {
  const declared = manifest.value.values ?? {};

  it('declares each default equal to the one the code falls back to', () => {
    const defaults = Object.fromEntries(
      Object.entries(declared).map(([name, value]) => [name, value.default]),
    );
    expect(defaults).toEqual(COLOR_DEFAULTS);
  });

  it('draws the same HTML with every default supplied as with no values at all', async () => {
    const supplied = Object.fromEntries(
      Object.entries(COLOR_DEFAULTS).map(([name, value]) => [name, { value }]),
    );
    expect(await html(supplied)).toBe(await html());
  });

  it('paints the paper a configured colour, found in the HTML', async () => {
    const painted = await html({ fundo: { value: '#123456' } });

    expect(painted).toContain('#123456');
    expect(await html()).not.toContain('#123456');
  });
});

describe('the contrast warning (TYTO-836)', () => {
  it('says nothing for the default colours or the house red', async () => {
    expect(await contrastWarnings()).toEqual([]);
    expect(await contrastWarnings({ destaque: { value: '#e30613' } })).toEqual([]);
  });

  // The example brief draws two artworks, and each reports its own pairs.
  it('warns once per pair and artwork for a yellow accent, keeping the colour', async () => {
    const warnings = await contrastWarnings({ destaque: { value: '#f2c200' } });

    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toContain("'#eceaea' on '#f2c200'");
    expect(warnings[0]).toContain('1.4:1');
    expect(warnings[1]).toContain("'#f2c200' on '#f7f4f4'");
    expect(await html({ destaque: { value: '#f2c200' } })).toContain('#f2c200');
  });

  it('warns only for the pair under the floor', async () => {
    // Band words in the accent itself: 1:1; the accent on the panel still reads.
    const warnings = await contrastWarnings({ 'texto-faixa': { value: '#1363d0' } });

    expect(warnings).toHaveLength(2);
    for (const warning of warnings) expect(warning).toContain("'#1363d0' on '#1363d0'");
  });

  it('keeps the floor at WCAG 2 large text', () => {
    expect(CONTRAST_FLOOR).toBe(3);
  });
});
