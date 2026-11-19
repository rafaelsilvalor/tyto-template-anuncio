import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * Every example brief, compiled the way Tyto compiles them (Tyto ADR 0152), against the HTML
 * the template produced last time it was reviewed.
 *
 * Nothing is measured and every face is a placeholder, so the snapshot moves when the
 * composition does and not when a machine has another font. No brand kit either: the logo is
 * the house's and stays out of this public repository.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({
  grid: { w: 1080, h: 1350, kind: 'grid' },
  story: { w: 1080, h: 1920, kind: 'story' },
});

describe.each(['duas-versoes'])('the example %s', (example) => {
  it('compiles to two versions in two formats, the HTML the template drew last time', async () => {
    const result = await compileTemplate({
      brief: read(`../templates/anuncio/examples/${example}.brief`),
      template,
      formats,
    });
    if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));

    const frames = result.value.frames;
    expect(frames.map((frame) => frame.format).sort()).toEqual(['grid', 'grid', 'story', 'story']);
    for (const [index, frame] of frames.entries()) {
      await expect(frame.html).toMatchFileSnapshot(
        `./__snapshots__/${example}-${index}-${frame.format}.html`,
      );
    }
  });
});
