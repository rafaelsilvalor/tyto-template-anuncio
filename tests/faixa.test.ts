import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { FAIXA_GRID, build } from '../src/template.js';

/**
 * The faixa head (TYTO-848), the DETRAN SP reference: the lockup at the top, the photograph
 * framed over a strip in `destaque` holding the status, the column below, the card square.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const brief = (cabeca: string, titulo: string): string =>
  [
    '---',
    'template: anuncio',
    'formats: [grid]',
    `cabeca: ${cabeca}`,
    '---',
    '::titulo',
    `  ${titulo}`,
    '',
    '::corpo',
    '  ## 145 vagas',
    '',
    '::lamina',
    '::apelo',
    '  Pacotes com | # 30% OFF | Por tempo limitado',
  ].join('\n');

const html = async (text: string): Promise<string> => {
  const result = await compileTemplate({ brief: text, template, formats });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.frames[0]!.html;
};

/** The CSS rule of the node named `name`. */
const ruleOf = (document: string, name: string): string => {
  const node = new RegExp(`<[a-z]+ id="([^"]+)" class="tyto-node" data-name="${name}"`).exec(
    document,
  );
  expect(node, name).not.toBeNull();
  const selector = `#${node![1]!.replace(/\./g, '\\.')} {`;
  const at = document.indexOf(selector);
  return at < 0 ? '' : document.slice(at, document.indexOf('}', at));
};

describe('the faixa head', () => {
  it('puts the parts before the name in the strip, in capitals, and not in the column', async () => {
    const document = await html(brief('faixa', 'Edital publicado | # Detran SP'));

    expect(document).toMatch(/data-name="status"[^>]*>.*EDITAL PUBLICADO/);
    expect(document).not.toMatch(/data-name="titulo"[^>]*>.*Edital publicado/i);
    expect(document).toMatch(/data-name="titulo"[^>]*>.*DETRAN SP/);
  });

  it('draws no status when the title has nothing before the name', async () => {
    const document = await html(brief('faixa', '# Detran SP | ## Edital publicado'));

    expect(document).not.toContain('data-name="status"');
    // No status, no strip: the photograph stands alone, as on PM SC (TYTO-850).
    expect(document).not.toContain('data-name="tarja"');
    expect(document).toMatch(/data-name="titulo"[^>]*>.*Edital publicado/);
  });

  it('frames the photograph over a strip in destaque, under the lockup at the top', async () => {
    const document = await html(brief('faixa', 'Edital publicado | # Detran SP'));
    const { faixa } = FAIXA_GRID;

    expect(ruleOf(document, 'tarja')).toContain(
      `matrix(1, 0, 0, 1, ${String(faixa.margin)}, ${String(faixa.photoTop)})`,
    );
    expect(ruleOf(document, 'tarja')).toContain('background-color: #1363d0');
    expect(ruleOf(document, 'imagem')).toContain(`border-radius: ${String(faixa.radius)}px`);
    expect(ruleOf(document, 'logo')).toContain(`, ${String(FAIXA_GRID.logo.top)})`);
    expect(document).not.toContain('data-name="painel"');
  });

  it('squares the card and drops the band’s shadow', async () => {
    const faixa = await html(brief('faixa', '# Detran SP'));
    const vitrine = await html(brief('vitrine', '# Detran SP'));

    // The vitrine's card corners are 39 px, the reference's; the faixa's are square.
    expect(vitrine).toContain('border-radius: 39px');
    expect(faixa).not.toContain('border-radius: 39px');
    expect(faixa).not.toContain('drop-shadow');
    expect(vitrine).toContain('drop-shadow');
  });
});
