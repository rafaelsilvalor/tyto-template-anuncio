import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { COLOR_DEFAULTS, build } from '../src/template.js';

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

const html = async (values?: SuppliedValues): Promise<string> => {
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
  return result.value.frames[0]!.html;
};

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
    const painted = await html({ paper: { value: '#123456' } });

    expect(painted).toContain('#123456');
    expect(await html()).not.toContain('#123456');
  });
});
