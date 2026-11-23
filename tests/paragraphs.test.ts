import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * A blank line inside a block opens a paragraph's room (Tyto ADR 0205, TYTO-845): the lines
 * written together stay at the line gap, and the frontmatter's `respiro` and `espaco-partes`
 * scale the paragraph's room and the room between the parts of one line.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const brief = (
  frontmatter: readonly string[],
  titulo: readonly string[],
  corpo: readonly string[],
) =>
  [
    '---',
    'template: anuncio',
    'formats: [grid]',
    ...frontmatter,
    '---',
    '::titulo',
    ...titulo.map((line) => (line === '' ? '' : `  ${line}`)),
    '',
    '::corpo',
    ...corpo.map((line) => (line === '' ? '' : `  ${line}`)),
    '',
    '::lamina',
    '::apelo',
    '  Lote Especial | # Pacotes com 40% OFF',
  ].join('\n');

const html = async (text: string): Promise<string> => {
  const result = await compileTemplate({ brief: text, template, formats });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.frames[0]!.html;
};

/** The y of the text node holding exactly `words`, in its parent's frame; 0 where it has none. */
const yOf = (document: string, words: string): number => {
  const node = new RegExp(
    `<div id="([^"]+)" class="tyto-node"[^>]*><div[^>]*><span[^>]*>${words}</span>`,
  ).exec(document);
  expect(node, words).not.toBeNull();
  const selector = `#${node![1]!.replace(/\./g, '\\.')} {`;
  const at = document.indexOf(selector);
  const rule = at < 0 ? '' : document.slice(at, document.indexOf('}', at));
  const matrix = /transform: matrix\(([^)]*)\)/.exec(rule);
  return matrix === null ? 0 : Number(matrix[1]!.split(',')[5]);
};

const TITULO = ['###### Edital publicado | # Polícia Penal PE'];
const TOGETHER = ['### 700 vagas', 'Banca Cebraspe', 'Salário de R$ 5,6 mil'];
const APART = ['### 700 vagas', 'Banca Cebraspe', '', 'Salário de R$ 5,6 mil'];

/** The rooms between the body's first and second line, and its second and third. */
const rooms = async (text: string): Promise<[number, number]> => {
  const document = await html(text);
  const [a, b, c] = ['700 vagas', 'Banca Cebraspe', 'Salário de R\\$ 5,6 mil'].map((words) =>
    yOf(document, words),
  );
  return [b! - a!, c! - b!];
};

describe('a blank line in the body', () => {
  it('opens more room before the line it separates, and leaves the lines written together alone', async () => {
    const [together12, together23] = await rooms(brief([], TITULO, TOGETHER));
    const [apart12, apart23] = await rooms(brief([], TITULO, APART));

    expect(apart12).toBeCloseTo(together12, 5);
    expect(apart23).toBeGreaterThan(together23);
  });

  it('opens twice the room with respiro: 2', async () => {
    const [, plain23] = await rooms(brief([], TITULO, TOGETHER));
    const [, apart23] = await rooms(brief([], TITULO, APART));
    const [, doubled23] = await rooms(brief(['respiro: 2'], TITULO, APART));

    // At this column's scale of 1, a paragraph takes the feed post's 35.6 px instead of the line
    // gap's 15.5, and respiro: 2 adds the 35.6 once more.
    expect(apart23 - plain23).toBeCloseTo(35.6 - 15.5, 5);
    expect(doubled23 - apart23).toBeCloseTo(35.6, 5);
  });
});

describe('a blank line in the title', () => {
  it('opens more room there too', async () => {
    const titled = (lines: readonly string[]) => brief([], lines, ['### 700 vagas']);
    const document = (lines: readonly string[]) => html(titled(lines));
    const room = async (lines: readonly string[]) => {
      const drawn = await document(lines);
      return yOf(drawn, 'Edital confirmado') - yOf(drawn, 'Banca X');
    };

    const together = await room(['# Alfa', 'Banca X', 'Edital confirmado']);
    const apart = await room(['# Alfa', 'Banca X', '', 'Edital confirmado']);

    expect(apart).toBeGreaterThan(together);
  });
});

describe('espaco-partes', () => {
  it('widens the room between the status and the exam’s name', async () => {
    const room = async (frontmatter: readonly string[]) => {
      const drawn = await html(brief(frontmatter, TITULO, TOGETHER));
      return yOf(drawn, 'POLÍCIA PENAL PE') - yOf(drawn, 'EDITAL PUBLICADO');
    };

    expect(await room(['espaco-partes: 2'])).toBeGreaterThan(await room([]));
  });
});
