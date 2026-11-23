import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * `{cor:<name>}…{/}` paints a span in one of the template's declared colours (TYTO-846): the
 * brief names a colour, written once in the frontmatter, and the rest of the line keeps its
 * level's colour and every word its level's weight.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const brief = (frontmatter: string, corpo: string): string =>
  [
    '---',
    'template: anuncio',
    'formats: [grid]',
    ...(frontmatter === '' ? [] : [frontmatter]),
    '---',
    '::titulo',
    '  Edital publicado | # Concurso {cor:texto}Alfa{/}',
    '',
    '::corpo',
    `  ${corpo}`,
    '',
    '::lamina',
    '::apelo',
    '  Lote Especial | # Pacotes com 40% OFF',
  ].join('\n');

const compiled = async (text: string) => {
  const result = await compileTemplate({ brief: text, template, formats });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return { html: result.value.frames[0]!.html, diagnostics: result.diagnostics };
};

/** The style of the span holding exactly `words`. */
const spanStyle = (html: string, words: string): string => {
  const found = new RegExp(`<span style="([^"]*)">${words.replace(/[$]/g, '\\$&')}</span>`).exec(
    html,
  );
  expect(found, words).not.toBeNull();
  return found![1]!;
};

describe('a colour mark', () => {
  it('paints only the marked words, in the colour the frontmatter set', async () => {
    const { html } = await compiled(
      brief("destaque: '#c8102e'", '## Ganhe até {cor:destaque}R$ 16 mil{/} por mês'),
    );

    expect(spanStyle(html, 'R$ 16 mil')).toContain('color: #c8102e');
    expect(spanStyle(html, 'Ganhe até ')).toContain('color: #4d4d4d');
    expect(spanStyle(html, ' por mês')).toContain('color: #4d4d4d');
  });

  it('keeps the level’s weight, colour only, in a Black name and in a Medium line', async () => {
    const { html } = await compiled(brief('', '## Ganhe até {cor:destaque}R$ 16 mil{/}'));

    // `#` is Black, in capitals; the marked word takes `texto` and stays Black.
    expect(spanStyle(html, 'ALFA')).toMatch(/font-weight: 900; color: #4d4d4d/);
    expect(spanStyle(html, 'R$ 16 mil')).toMatch(/font-weight: 500; color: #1363d0/);
  });

  it('lets bold inside it make the words heavier, in the mark’s colour', async () => {
    const { html } = await compiled(brief('', '## Ganhe até {cor:destaque}**R$ 16 mil**{/}'));

    expect(spanStyle(html, 'R$ 16 mil')).toMatch(/font-weight: 700; color: #1363d0/);
  });

  it('leaves the words in their level’s colour for a name the template does not declare', async () => {
    const { html } = await compiled(brief('', '## Ganhe até {cor:laranja}R$ 16 mil{/}'));

    // Unmapped, the mark adds nothing, so its words join the line's one run.
    expect(spanStyle(html, 'Ganhe até R$ 16 mil')).toContain('color: #4d4d4d');
  });

  it('warns when a marked colour is too light on the panel', async () => {
    const { diagnostics } = await compiled(brief('', '## Ganhe até {cor:texto-faixa}R$ 16 mil{/}'));

    expect(diagnostics.filter((item) => item.code === 'W_TEMPLATE_LOW_CONTRAST')).toHaveLength(1);
  });

  it('adds no warning for a brief without marks', async () => {
    const { diagnostics } = await compiled(brief('', '## Ganhe até R$ 16 mil'));

    expect(diagnostics.filter((item) => item.code === 'W_TEMPLATE_LOW_CONTRAST')).toHaveLength(0);
  });
});

describe('more highlight colours (TYTO-847)', () => {
  it('paints the price in destaque-2 while the name keeps destaque', async () => {
    const { html } = await compiled(
      brief(
        "destaque-2: '#c8102e'",
        '## Ganhe até {cor:destaque-2}R$ 16 mil{/} e {cor:destaque-3}bônus{/}',
      ),
    );

    expect(spanStyle(html, 'R$ 16 mil')).toContain('color: #c8102e');
    // destaque-3 was not set: it is destaque's blue, as is the name.
    expect(spanStyle(html, 'bônus')).toContain('color: #1363d0');
    expect(spanStyle(html, 'CONCURSO ')).toContain('color: #1363d0');
  });

  it('warns when a second highlight is too light on the panel', async () => {
    const { diagnostics } = await compiled(
      brief("destaque-2: '#f0f0f0'", '## Ganhe até {cor:destaque-2}R$ 16 mil{/}'),
    );

    expect(diagnostics.filter((item) => item.code === 'W_TEMPLATE_LOW_CONTRAST')).toHaveLength(1);
  });

  it('takes a colour set by the frontmatter only for the names the template declares', async () => {
    const { diagnostics } = await compiled(
      brief("destaque-4: '#c8102e'", '## Ganhe até R$ 16 mil'),
    );

    expect(diagnostics.map((item) => item.code)).toContain('E_UNKNOWN_SLOT');
  });
});
