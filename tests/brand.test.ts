import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

import type { BrandKit } from '@tyto/core';

/**
 * The brand kit's lockup and background pattern (Tyto ADR 0066, ADR 0228, TYTO-844). The kit
 * here is invented: a plugin file's configuration names the real one, which never enters this
 * repository.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const parsed = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!parsed.ok) throw new Error(parsed.error.map((item) => item.message).join('\n'));
// A configuration picks the brand in the app (ADR 0155); here the manifest names a test one.
const template = defineTemplate({ ...parsed.value, brand: 'test-brand' }, build);
const formats = formatCatalogue({
  grid: { w: 1080, h: 1350, kind: 'grid' },
  story: { w: 1080, h: 1920, kind: 'story' },
});

const SQUARE = { box: { w: 10, h: 10 }, d: 'M0 0H10V10H0Z', fillRule: 'nonzero' } as const;
const BARS = {
  box: { w: 40, h: 10 },
  d: 'M0 0H40V4H0ZM0 6H20V10H0Z',
  fillRule: 'nonzero',
} as const;
const LATTICE = {
  tile: { w: 10, h: 10 },
  layers: [
    { tone: 'primary', d: 'M0 0L10 10M10 0L0 10', stroke: 0.1 },
    { tone: 'secondary', d: 'M4 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z', fillRule: 'nonzero' },
  ],
} as const;

const BRIEF = [
  '---',
  'template: anuncio',
  'formats: [grid, story]',
  '---',
  '::titulo',
  '  Edital publicado | # Concurso Alfa',
  '',
  '::lamina',
  '::apelo',
  '  Lote Especial | # Pacotes com 40% OFF',
].join('\n');

const render = async (kit: BrandKit | undefined): Promise<readonly string[]> => {
  const result = await compileTemplate({
    brief: BRIEF,
    template,
    formats,
    ...(kit === undefined ? {} : { brandKits: new Map([['test-brand', kit]]) }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.frames.map((frame) => frame.html);
};

describe('the lockup', () => {
  it('sets the kit’s wordmark beside its logo, in the accent', async () => {
    const [grid] = await render({ logo: SQUARE, wordmark: BARS });

    expect(grid).toContain('data-name="assinatura"');
    expect(grid).toMatch(
      /data-name="wordmark"[^>]*><path d="M0 0H40V4H0ZM0 6H20V10H0Z"[^>]*fill="#1363d0"/,
    );
  });

  it('draws the logo alone when the kit has no wordmark', async () => {
    const [grid] = await render({ logo: SQUARE });

    expect(grid).toContain('data-name="logo"');
    expect(grid).not.toContain('data-name="assinatura"');
  });
});

describe('the background pattern', () => {
  it('lays the kit’s lattice faint over the panel, masked by it, in both formats', async () => {
    const frames = await render({ logo: SQUARE, pattern: LATTICE });

    for (const html of frames) {
      expect(html).toContain('data-name="pattern"');
      expect(html).toMatch(/data-name="painel"/);
      expect(html).toContain('mask-image');
      expect(html).toContain('opacity: 0.08');
    }
    expect(frames[0]).toContain('id="lamina-1.grid.painel"');
  });

  it('paints the lines in the accent and the dots in the text colour', async () => {
    const [grid] = await render({ logo: SQUARE, pattern: LATTICE });

    expect(grid).toMatch(/data-name="pattern-primary-0"[^>]*><path [^>]*stroke="#1363d0"/);
    expect(grid).toMatch(/data-name="pattern-secondary-1"[^>]*><path [^>]*fill="#4d4d4d"/);
  });

  it('draws no pattern and names no panel id when the kit has none', async () => {
    const [grid] = await render({ logo: SQUARE });

    expect(grid).not.toContain('data-name="pattern"');
    expect(grid).not.toContain('lamina-1.grid.painel');
  });

  it('keeps the lattice registered to the frame when the panel moves', async () => {
    // The tile is drawn 336 wide; a tile corner sits at (40, 217) of the frame. This panel
    // starts at 486, so the first tile starts at (40 − 336, 217 − 486) inside it: the frame's
    // 217, not the panel's own top plus 217.
    const [grid] = await render({ logo: SQUARE, pattern: LATTICE });

    expect(grid).toContain('id="lamina-1.grid.painel"');
    expect(grid).toContain('#lamina-1\\.grid\\.painel { transform: matrix(1, 0, 0, 1, 0, 486)');
    expect(grid).toContain('matrix(1, 0, 0, 1, -296, -269)');
  });
});
