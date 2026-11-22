import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * Every block is shared or a slide's own (Tyto ADR 0225, TYTO-836): written before the slides or
 * after `::comum` it is every artwork's; written inside a `::lamina` it replaces the shared one
 * on that artwork only.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const frames = async (brief: string): Promise<string[]> => {
  const result = await compileTemplate({ brief, template, formats });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.frames.map((frame) => frame.html);
};

const BRIEF = [
  '---',
  'template: anuncio',
  'formats: [grid]',
  '---',
  '::titulo',
  '  # Concurso Alfa',
  '',
  '::lamina',
  '::apelo',
  '  Lote Especial | # Pacotes com 40% OFF',
  '',
  '::lamina',
  '::titulo',
  '  # Concurso Beta',
  '::apelo',
  '  Lote Especial | # Pacotes com 40% OFF',
].join('\n');

describe('a block written inside a slide', () => {
  // Tyto ADR 0227: a slide's own block adds to the shared one, below it.
  it('adds to the shared title on that slide only', async () => {
    const [first, second] = await frames(BRIEF);

    expect(first).toContain('CONCURSO ALFA');
    expect(first).not.toContain('CONCURSO BETA');
    expect(second).toContain('CONCURSO ALFA');
    expect(second).toContain('CONCURSO BETA');
    expect(second!.indexOf('CONCURSO ALFA')).toBeLessThan(second!.indexOf('CONCURSO BETA'));
  });

  it('shares an offer written after ::comum with every slide', async () => {
    const brief = [
      '---',
      'template: anuncio',
      'formats: [grid]',
      '---',
      '::lamina',
      '::titulo',
      '  # Concurso Alfa',
      '',
      '::lamina',
      '::titulo',
      '  # Concurso Beta',
      '',
      '::comum',
      '::apelo',
      '  Lote Especial | # Pacotes com 40% OFF',
    ].join('\n');

    const all = await frames(brief);

    expect(all).toHaveLength(2);
    for (const html of all) expect(html).toContain('Pacotes com 40% OFF');
  });
});

describe('named shared bodies placed per slide (TYTO-840)', () => {
  const NAMED = [
    '---',
    'template: anuncio',
    'formats: [grid]',
    '---',
    '::titulo',
    '  # Concurso Alfa',
    '',
    '::corpo {nome: vagas, peso: 2}',
    '  ### Vagas abertas',
    '',
    '::corpo {nome: salario, peso: 4}',
    '  ## Salário alto',
    '',
    '::lamina',
    '::corpo {nome: vagas}',
    '::apelo',
    '  Lote Especial | # Pacotes com 40% OFF',
    '::corpo {nome: salario}',
    '',
    '::lamina',
    '::apelo',
    '  Pacote | # Garantia',
  ].join('\n');

  const at = (html: string, words: string): number => {
    const index = html.indexOf(words);
    expect(index, words).toBeGreaterThan(-1);
    return index;
  };

  it('draws both bodies, around the offer where the slide placed them', async () => {
    const [first] = await frames(NAMED);

    expect(at(first!, 'Vagas abertas')).toBeLessThan(at(first!, 'Pacotes com 40% OFF'));
    expect(at(first!, 'Pacotes com 40% OFF')).toBeLessThan(at(first!, 'Salário alto'));
  });

  it('draws both bodies above the offer on a slide that places none', async () => {
    const [, second] = await frames(NAMED);

    expect(at(second!, 'Vagas abertas')).toBeLessThan(at(second!, 'Salário alto'));
    expect(at(second!, 'Salário alto')).toBeLessThan(at(second!, 'Garantia'));
  });
});
