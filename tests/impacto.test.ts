import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build, discountOf } from '../src/template.js';

/**
 * The impacto offer (TYTO-850), the PM SC reference: the `::apelo` read as the card reads it,
 * the main part a giant discount in a block of `destaque`, the parts after it beside a rule, the
 * parts before it above the block.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const brief = (oferta: string, apelo: string): string =>
  [
    '---',
    'template: anuncio',
    'formats: [grid]',
    `oferta: ${oferta}`,
    '---',
    '::titulo',
    '  # PM SC Soldado',
    '',
    '::lamina',
    '::apelo',
    `  ${apelo}`,
  ].join('\n');

const html = async (text: string): Promise<string> => {
  const result = await compileTemplate({ brief: text, template, formats });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.frames[0]!.html;
};

const APELO = 'Pacote completo | # 40% OFF | Black \\ Friday';

describe('discountOf', () => {
  it.each([
    ['40% OFF', { figure: '40', percent: true, unit: 'OFF' }],
    ['30%', { figure: '30', percent: true, unit: '' }],
    ['12,5 % de desconto', { figure: '12,5', percent: true, unit: 'de desconto' }],
    ['3 meses grátis', { figure: '3', percent: false, unit: 'meses grátis' }],
  ])('reads %s', (text, expected) => {
    expect(discountOf(text)).toEqual(expected);
  });

  it('reads no discount from words that do not start with a figure', () => {
    expect(discountOf('Garantia de 7 dias')).toBeUndefined();
  });
});

describe('the impacto offer', () => {
  it('draws the figure, the % over the unit, a rule and the side in one block', async () => {
    const document = await html(brief('impacto', APELO));

    expect(document).toMatch(/data-name="impacto-numero"[^>]*>.*>40</);
    expect(document).toMatch(/data-name="impacto-porcento"[^>]*>.*>%</);
    expect(document).toMatch(/data-name="impacto-unidade"[^>]*>.*>OFF</);
    expect(document).toContain('data-name="impacto-fio"');
    expect(document).toMatch(/data-name="impacto-lado"[^>]*>.*BLACK.*FRIDAY/);
    expect(document).toMatch(/data-name="impacto-titulo"[^>]*>.*Pacote completo/);
    expect(document).not.toContain('data-name="cartao"');
  });

  it('draws no rule when nothing follows the discount', async () => {
    const document = await html(brief('impacto', '# 40% OFF'));

    expect(document).toContain('data-name="impacto-numero"');
    expect(document).not.toContain('data-name="impacto-fio"');
    expect(document).not.toContain('data-name="impacto-titulo"');
  });

  it('falls back to the card when the main part is no figure', async () => {
    const document = await html(brief('impacto', 'Pacote | # Garantia de 7 dias'));

    expect(document).not.toContain('data-name="impacto"');
    expect(document).toContain('data-name="cartao"');
  });

  it('leaves the card as it was when the offer is the card', async () => {
    const card = await html(brief('cartao', APELO));
    const none = await html(brief('cartao', APELO).replace('oferta: cartao\n', ''));

    expect(card).toBe(none);
    expect(card).not.toContain('data-name="impacto"');
  });
});
