import { readFileSync } from 'node:fs';

import {
  type Scene,
  type SceneNode,
  defineTemplate,
  formatCatalogue,
  parseManifest,
} from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * The block adjustments of Tyto's slot vocabulary (TYTO-855, through the kit's `scalesOf`,
 * TYTO-853): `peso` to 8, `tamanho` for the letters alone, `espaco` for the spaces inside a block
 * alone, `distancia` for the room above a block; and a piece after a typed `\` at its own level
 * (Tyto ADR 0229).
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/anuncio/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

interface Blocks {
  readonly cabeca?: string;
  readonly oferta?: string;
  readonly titulo?: string;
  readonly titulo2?: string;
  readonly corpo?: string;
  readonly apelo?: string;
  readonly nota?: string;
}

/** A one-slide brief; each block's text may open with its adjustments, `{peso: 6} words`. */
const brief = (blocks: Blocks): string => {
  const block = (name: string, text: string | undefined): string[] => {
    if (text === undefined) return [];
    const braces = /^(\{[^}]*\}) ?/u.exec(text);
    const head = braces === null ? `::${name}` : `::${name} ${braces[1]!}`;
    const words = braces === null ? text : text.slice(braces[0].length);
    return [head, ...words.split('\n').map((line) => `  ${line}`), ''];
  };
  return [
    '---',
    'template: anuncio',
    'formats: [grid]',
    ...(blocks.cabeca === undefined ? [] : [`cabeca: ${blocks.cabeca}`]),
    ...(blocks.oferta === undefined ? [] : [`oferta: ${blocks.oferta}`]),
    '---',
    ...block('titulo', blocks.titulo ?? '# Polícia Penal PE'),
    ...block('corpo', blocks.corpo),
    '::lamina',
    ...block('apelo', blocks.apelo ?? 'Lote Especial | # 40% OFF'),
    ...block('nota', blocks.nota),
  ].join('\n');
};

const sceneOf = async (text: string): Promise<Scene> => {
  const result = await compileTemplate({ brief: text, template, formats });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.scene;
};

interface Drawn {
  readonly name: string;
  readonly words: string;
  readonly top: number;
  readonly size: number;
}

/** Every text node of the first artwork, with its top in the frame and its first run's size. */
const textsOf = (scene: Scene): Drawn[] => {
  const found: Drawn[] = [];
  const walk = (nodes: readonly SceneNode[], y: number): void => {
    for (const node of nodes) {
      const top = y + node.transform.y;
      if (node.kind === 'text') {
        const runs = node.runs.filter((run) => run.kind === 'text');
        found.push({
          name: node.name ?? '',
          words: runs.map((run) => (run.kind === 'text' ? run.text : '')).join(''),
          top,
          size: runs[0]?.kind === 'text' ? runs[0].size : 0,
        });
      }
      if (node.kind === 'group') walk(node.children, top);
    }
  };
  walk(scene.artworks[0]?.frames[0]?.children ?? [], 0);
  return found;
};

const find = (texts: readonly Drawn[], words: string): Drawn => {
  const found = texts.find((text) => text.words.toLowerCase().includes(words.toLowerCase()));
  expect(found, words).toBeDefined();
  return found!;
};

const BODY = '### 700 vagas\nBanca Cebraspe\nSalário de R$ 5,6 mil';

/** The tops of the body's three lines, and each line's size. */
const bodyOf = async (adjustments: string): Promise<{ tops: number[]; sizes: number[] }> => {
  const texts = textsOf(await sceneOf(brief({ corpo: `${adjustments} ${BODY}`.trim() })));
  const lines = ['700 vagas', 'Banca Cebraspe', 'Salário de R$ 5,6 mil'].map((words) =>
    find(texts, words),
  );
  return { tops: lines.map((line) => line.top), sizes: lines.map((line) => line.size) };
};

const steps = (tops: readonly number[]): number[] =>
  tops.slice(1).map((top, index) => top - tops[index]!);

describe('peso up to 8', () => {
  it('draws the body at 1.6, 1.8 and 2 times its size at 6, 7 and 8', async () => {
    const sizeAt = async (peso: string): Promise<number> =>
      find(textsOf(await sceneOf(brief({ corpo: `{peso: ${peso}} ### 700 vagas` }))), '700 vagas')
        .size;
    const base = await sizeAt('3');
    expect([await sizeAt('6'), await sizeAt('7'), await sizeAt('8')]).toEqual([
      base * 1.6,
      base * 1.8,
      base * 2,
    ]);
  });
});

describe('tamanho and espaco in the body', () => {
  it('draws as before when neither is written: peso moves letters and spaces together', async () => {
    const plain = await bodyOf('');
    const heavy = await bodyOf('{peso: 4}');
    expect(heavy.sizes).toEqual(plain.sizes.map((size) => size * 1.2));
  });

  it('lets tamanho grow the letters alone: peso 5’s letters, the line gap as designed', async () => {
    const plain = await bodyOf('');
    const heavy = await bodyOf('{peso: 5}');
    const larger = await bodyOf('{tamanho: 5}');
    expect(larger.sizes).toEqual(heavy.sizes);
    expect(larger.sizes).toEqual(plain.sizes.map((size) => size * 1.4));
    // Same letters, so each step differs only by the line gap: 15.5 at 1.4 against 15.5 at 1.
    steps(heavy.tops).forEach((step, index) => {
      expect(step - steps(larger.tops)[index]!).toBeCloseTo(15.5 * 0.4, 3);
    });
  });

  it('lets espaco open the spaces alone, the letters kept', async () => {
    const plain = await bodyOf('');
    const looser = await bodyOf('{espaco: 5}');
    expect(looser.sizes).toEqual(plain.sizes);
    steps(looser.tops).forEach((step, index) => {
      expect(step - steps(plain.tops)[index]!).toBeCloseTo(15.5 * 0.4, 3);
    });
  });

  it('lets espaco replace peso’s side only: {peso: 5, espaco: 3} is {tamanho: 5}', async () => {
    const mixed = await bodyOf('{peso: 5, espaco: 3}');
    const larger = await bodyOf('{tamanho: 5}');
    expect(mixed.sizes).toEqual(larger.sizes);
    expect(steps(mixed.tops)).toEqual(steps(larger.tops));
  });
});

describe('espaco in the head and the offer', () => {
  /** The sizes of two texts and the distance between their tops. */
  const pairOf = async (
    blocks: Blocks,
    upper: string,
    lower: string,
  ): Promise<{ sizes: [number, number]; room: number }> => {
    const texts = textsOf(await sceneOf(brief(blocks)));
    const [a, b] = [find(texts, upper), find(texts, lower)];
    return { sizes: [a.size, b.size], room: b.top - a.top };
  };

  it('opens the room between the status and the name, the letters kept', async () => {
    const titulo = '###### Edital publicado | # Polícia Penal PE';
    const plain = await pairOf({ titulo }, 'EDITAL PUBLICADO', 'POLÍCIA PENAL PE');
    const looser = await pairOf(
      { titulo: `{espaco: 5} ${titulo}` },
      'EDITAL PUBLICADO',
      'POLÍCIA PENAL PE',
    );
    expect(looser.sizes).toEqual(plain.sizes);
    expect(looser.room).toBeGreaterThan(plain.room);
  });

  it('opens the card’s inner room, the letters kept', async () => {
    const apelo = 'Lote Especial | # 40% OFF';
    const plain = await pairOf({ apelo }, 'Lote Especial', '40% OFF');
    const looser = await pairOf({ apelo: `{espaco: 5} ${apelo}` }, 'Lote Especial', '40% OFF');
    expect(looser.sizes).toEqual(plain.sizes);
    // Words centred in segments 76 (title) and 117 (band) tall: the band's words move down by half
    // of both growths, at 1.4 against 1.
    expect(looser.room - plain.room).toBeCloseTo(((76 + 117) / 2) * 0.4, 3);
  });

  it('opens the impacto’s room around the figure, the letters kept', async () => {
    const apelo = 'Pacotes com | # 40% OFF | Só hoje';
    const plain = await pairOf({ oferta: 'impacto', apelo }, 'Pacotes com', '40');
    const looser = await pairOf(
      { oferta: 'impacto', apelo: `{espaco: 5} ${apelo}` },
      'Pacotes com',
      '40',
    );
    expect(looser.sizes).toEqual(plain.sizes);
    // The title's gap (36) and the panel's padding (28) above the figure, at 1.4 against 1.
    // At least that; the figure's unit stack, centred beside it, may add a little.
    expect(looser.room - plain.room).toBeGreaterThanOrEqual((36 + 28) * 0.4 - 0.001);
  });
});

describe('distancia', () => {
  /** The top of the body's line and of the offer's title. */
  const topsOf = async (apelo: string): Promise<[number, number]> => {
    const texts = textsOf(await sceneOf(brief({ corpo: '### 700 vagas', apelo })));
    return [find(texts, '700 vagas').top, find(texts, 'Lote Especial').top];
  };

  it('closes the room above the offer at 1 and doubles it at 5, as a share of its gap', async () => {
    const [bodyPlain, plain] = await topsOf('Lote Especial | # 40% OFF');
    const [bodyClose, close] = await topsOf('{distancia: 1} Lote Especial | # 40% OFF');
    const [bodyFar, far] = await topsOf('{distancia: 5} Lote Especial | # 40% OFF');
    const room = (body: number, offer: number): number => offer - body;
    const gap = room(bodyPlain, plain) - room(bodyClose, close);
    expect(gap).toBeGreaterThan(0);
    expect(room(bodyFar, far) - room(bodyPlain, plain)).toBeCloseTo(gap, 3);
  });
});

describe('the note (TYTO-858)', () => {
  const NOTE = 'Só nesta versão.';

  it('is drawn by the tests’ own compile, which measures no font', async () => {
    const texts = textsOf(await sceneOf(brief({ nota: NOTE })));
    expect(find(texts, NOTE).name).toBe('nota');
  });

  it('draws at 1.6, 1.8 and 2 times its size at peso 6, 7 and 8', async () => {
    const sizeAt = async (peso: string): Promise<number> =>
      find(textsOf(await sceneOf(brief({ nota: `{peso: ${peso}} ${NOTE}` }))), NOTE).size;
    const base = await sizeAt('3');
    expect([await sizeAt('6'), await sizeAt('7'), await sizeAt('8')]).toEqual([
      base * 1.6,
      base * 1.8,
      base * 2,
    ]);
  });

  it('closes the room above it at distancia 1 and doubles it at 5', async () => {
    const roomOf = async (nota: string): Promise<number> => {
      const texts = textsOf(await sceneOf(brief({ nota })));
      return find(texts, NOTE).top - find(texts, 'Lote Especial').top;
    };
    const plain = await roomOf(NOTE);
    const close = await roomOf(`{distancia: 1} ${NOTE}`);
    const far = await roomOf(`{distancia: 5} ${NOTE}`);
    // The proof gap above the note is the feed post's 32 px.
    expect(plain - close).toBeCloseTo(32, 3);
    expect(far - plain).toBeCloseTo(32, 3);
  });
});

describe('a piece after a typed break (Tyto ADR 0229)', () => {
  it('draws the lead-in at the base level and the name at the name’s size, on the next line', async () => {
    const texts = textsOf(
      await sceneOf(brief({ titulo: 'Prepare-se com o \\ # líder em aprovações' })),
    );
    const lead = find(texts, 'Prepare-se com o');
    const name = find(texts, 'líder em aprovações');
    expect(name.size).toBeGreaterThan(lead.size);
    expect(name.top).toBeGreaterThan(lead.top);
  });

  it('keeps a name written over two lines at one size, as before', async () => {
    const texts = textsOf(await sceneOf(brief({ titulo: '# Concurso ABIN \\ 2027' })));
    expect(texts.filter((text) => text.name.startsWith('titulo'))).toHaveLength(1);
  });

  it('keeps a piece joined to the name out of the faixa’s strip', async () => {
    const texts = textsOf(
      await sceneOf(
        brief({ cabeca: 'faixa', titulo: 'Edital publicado | Prepare-se com o \\ # Detran SP' }),
      ),
    );
    expect(find(texts, 'EDITAL PUBLICADO').name).toBe('status');
    expect(find(texts, 'Prepare-se com o').name).toMatch(/^titulo/u);
    expect(texts.some((text) => text.name === 'status' && /prepare/iu.test(text.words))).toBe(
      false,
    );
  });
});
