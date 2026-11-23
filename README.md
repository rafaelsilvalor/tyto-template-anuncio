# tyto-template-anuncio

`anuncio`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its own repository:
a remarketing ad for one exam, its facts at the head and an offer below, in a feed post
(1080×1350) and a story (1080×1920). It belongs to Tyto's E18 (TYTO-803, Tyto ADR 0151): a
template that lives, is tested and is released here, with no pull request in Tyto's repository.

**This repository holds the composition only.** The logo, the wordmark and the background
pattern are not here: Tyto hands them to the template from the brand kit installed on the
machine, under the brand a plugin file's configuration names (Tyto ADR 0063, ADR 0155). Without
a kit it draws a placeholder logo, no wordmark and no pattern (ADR 0065). The example briefs are
invented copy.

**Two layouts are drawn so far: `vitrine` with `cartao`, and `faixa` with `cartao` (below).** The photograph fills the top; a panel
with rounded corners rises over it, and in it one column of Tyto's kit (`blockColumn`, Tyto
ADR 0224) holds the head, the offer card and the note **in the order the brief wrote them**,
centred together between the panel's top and the logo, which stays pinned at the foot. The
head's `#` line grows or shrinks to fill the width on one line (the kit's `mainLineScale`,
0.7 to 1.6 of the reference) and its other lines follow. When the column does not fit, every
block shrinks by one factor down to 0.7; then the panel rises over the photograph, which keeps
at least a quarter of the frame; what is still left over is reported as an overflow. Every
number the layout uses is a declared parameter (`ANUNCIO_PARAMETERS` beside the kit's own),
the reference's value its default. The other heads and offers named below are declared and draw
this one until they arrive, with the kit pieces they consume (Tyto TYTO-797 to TYTO-801).

**The brief speaks Tyto's shared vocabulary** (Tyto `docs/slot-vocabulary.md`), so what a
writer learned in another template holds here:

- **`::titulo`** is the head, ranked by its marks and read by the kit's `levelsOf`: `|` between
  the parts of a line, `#` to `######` six levels and an unmarked part a seventh; a line of `---`
  the three dots. The first line with no mark is read by position; a later unmarked line is
  supporting. Shared before the slides or after `::comum`; written inside a `::lamina` it is
  that artwork's own and adds to the shared one there (Tyto ADR 0227).
- **Each level has its look** (TYTO-836): a share of the exam's name size, a weight, a colour.

  | Level    | Size         | Weight                   | Colour     | Use                        |
  | -------- | ------------ | ------------------------ | ---------- | -------------------------- |
  | `#`      | 1            | Black, capitals          | `destaque` | the exam's name            |
  | `##`     | 0.75         | Medium                   | `texto`    | status, salary             |
  | `###`    | 0.56         | Medium                   | `texto`    | a stronger supporting line |
  | `####`   | 0.48         | Black                    | `destaque` | a highlight in the accent  |
  | `#####`  | 0.48         | Light                    | `texto`    | a quiet line               |
  | `######` | 0.44         | Light, capitals, tracked | `destaque` | a label before the name    |
  | none     | 0.40 at most | Light                    | `texto`    | the smallest line          |

  An unmarked line is never larger than the smallest marked level its block uses, so the marks
  keep their weight.

- **`::corpo`** is the general information under the title — vacancies, exam board, roles,
  salary — in the same marks, as a block of its own (Tyto TYTO-832, the kit's `bodyBlock`): it
  keeps its sizes when the exam's name grows or shrinks to fit, and takes its own `peso`. Its
  first line is a fact, never a name. Shared before the slides or after `::comum`, a slide's own
  inside a `::lamina`. A brief with no `::corpo` draws every line in the title, as 0.4.0 did.
- **Several `::corpo`, each with its own `peso`** (0.7.0, Tyto ADR 0227): the vacancies and the
  salary as two blocks, say. Name a shared one with `{nome: vagas}` and, inside a slide, an
  empty `::corpo {nome: vagas}` draws it right there; a slide that places none draws the shared
  bodies under the title. Several adjustments share one brace: `{nome: salario, peso: 4}`.
- **`::lamina`**, one per artwork, and the **`::apelo`**, the slide's own or shared: the card takes the shape of the
  line's parts. The main part is the band, the parts before it the title, the parts after it
  the foot, and the band takes the corners of the edge it reaches; the kit's `card` draws it.
  Band and title words shrink to one line before they wrap, and a segment grows to hold them.
- **`::nota`** is the proof line, shared or a slide's own (Tyto ADR 0225). Written after
  `::comum`, which closes the slides, it is every artwork's and goes under the card; written
  inside a `::lamina` it is that artwork's own and adds to the shared one there. A note
  written before the first slide is every artwork's too, and is drawn **above** the card, since
  the brief is read top to bottom as the art.
- **`{peso: 1}` to `{peso: 5}`** on any block, 3 the designed size: 1 draws it at 0.7, 2 at
  0.85, 4 at 1.2, 5 at 1.4 (Tyto `docs/slot-vocabulary.md`, `peso`); the head never grows past
  the width its main line fills.

`**…**` is bold wherever it is written. The words are never changed: the marks only rank them.

## Install into Tyto

```
tyto plugin install git+https://github.com/rafaelsilvalor/tyto-template-anuncio.git
```

Tyto clones the default branch and never builds it, so `dist/index.js` is committed on `main`
and every release is a tag of it. To take a change pushed here, run the same command again:
installing a name that is already installed replaces it.

A pack brings templates and no formats. Copy `templates/formats.yaml` into the project that
renders `anuncio`, or merge its `grid` and `story` lines into the project's own. Then a brief
writes the head once and one `::lamina` per artwork:

```
---
template: anuncio
formats: [grid, story]
---
::titulo
  ## Edital publicado | # Concurso QC Regula

::corpo
  ### Vagas para Analista Técnico
  ## Ganhe até R$ 9 mil por mês!

::lamina
::apelo
  Lote Especial | # Pacotes com **40% OFF**

::lamina
::apelo
  # Pacote Completo | 7 dias de garantia

::comum
::nota
  Estude como **7 a cada 10 aprovados**
```

Two versions in two formats are four images. `imagem:` and `recorte:` in the frontmatter name
the head's photograph and a teacher cut out with no background.

**0.13.0 sets the references' gaps** (TYTO-852). Measured ink to ink against TRT 4 (vitrine)
and DETRAN SP (faixa): the room between two parts of one line, the status and the name, drops
from 29/32 px to 15/20 (feed/story); the faixa gets its own name, line, paragraph, head and note
gaps instead of the vitrine's. Every gap now lands within 6 px of its reference. Briefs move:
lines sit closer, and a column that had to shrink shrinks less.

**0.12.0 draws the `impacto` offer** (TYTO-850), the PM SC reference: the discount as a giant
figure in a block of `destaque`, its `%` over its unit beside it, a rule, and the words after
it in Black on the right; the words before it centred above the block. It reads the same
`::apelo` as the card: `Pacote completo | # 40% OFF | Black \ Friday`. A main part that does
not start with a figure (`# Garantia de 7 dias`) draws the card instead. Write `oferta: impacto`
or reach it through a configuration. Under the faixa, a title with nothing before the name now
draws no strip (PM SC).

**0.11.0 draws the `faixa` head** (TYTO-848), the DETRAN SP reference: the lockup at the top,
the photograph framed with rounded corners over a strip in `destaque`, the column below on the
plain ground, the card with square corners and no shadow. The strip holds the parts written
before the exam's name in the title's first line (`Edital publicado | # Detran SP`), in light
capitals; a title with nothing before the name draws no strip, the photograph alone (PM SC). The name keeps its
reference size and only shrinks; the kit's pattern is not drawn (the reference has none). Write
`cabeca: faixa` in the frontmatter, or reach it through a `faixa-cartao` configuration.

**0.10.0 lets a blank line open room** (TYTO-845, Tyto ADR 0205): in `::titulo` or `::corpo`,
lines written together stay at the line gap, and a blank line between two lines opens the
name's larger gap (35.6 px in the feed post, 65 in the story) before the next one. Two values
scale the spacing from the frontmatter: `respiro: 2` doubles the room a blank line opens, and
`espaco-partes: 1.5` widens the room between the parts of one line, such as the status above
the exam's name. Both default to 1; a brief without blank lines draws what 0.9.0 drew.

**0.9.0 paints a span with a colour mark, in up to three highlights.** `{cor:<name>}…{/}`
(TYTO-846) paints a span in one of the declared colours, by
its name: `## Ganhe até {cor:destaque}R$ 16 mil{/}` paints only the price. Colour only: the words
keep their level's weight, and `**…**` makes them heavier. A name the template does not declare
leaves the words in their level's colour. A marked colour on the panel is checked against
`fundo` like the name is. Two more highlights, `destaque-2` and `destaque-3` (TYTO-847), are
reached only by the mark: set `destaque-2: '#c8102e'` in the frontmatter and write
`{cor:destaque-2}R$ 16 mil{/}`. Unset, they are `destaque`'s default blue.

**0.8.0 draws the kit's lockup and pattern:** the kit's wordmark beside its logo, both in
`destaque`, at the reference's sizes (Tyto ADR 0066), and the kit's background pattern over the
panel at 8%, cut to it, lines in `destaque` and dots in `texto` (Tyto ADR 0228). The lattice is
registered to the frame, a tile corner at x 40 and y 217 modulo 336 as in the reference, so it
stays put when a long head raises the panel. It needs a Tyto on plugin API 0.32 (`engine

> =0.32`). Without a kit every render is what 0.7.0 drew.

**0.7.0 adds blocks up and places them by name:** a block written inside a slide now comes
with the shared one of its kind instead of replacing it, `::corpo` may be written several times,
and a named shared block is placed per slide by an empty directive (Tyto ADR 0227). A 0.6 brief
that wrote the same block both outside and inside a slide now draws both there.

**0.6.0 gives every level its look and the colours their brief names:** six title levels,
`peso` 1 to 5 with 3 the old default (a 0.5 brief's `{peso: 1}` now draws at 0.7, `{peso: 3}`
at the designed size), `::titulo` and `::apelo` shared or a slide's own, and the colours renamed
`destaque`, `fundo`, `texto`, `texto-faixa` (a configuration that set `accent`, `paper` or `ink`
sets the new names). A low-contrast pair is reported.

**0.5.0 adds `::corpo`:** the title keeps the exam's name and its status; vacancies, board,
roles and salary go in `::corpo` under it. A 0.4 brief still draws, every line in the title,
and its unmarked lines come out a little smaller than before.

**0.4.0 draws the brief in its order:** a `::nota` written before the slides, as 0.3 briefs did,
now comes out above the card. Move it after `::comum` to keep it under the card.

**0.3.0 renamed what 0.2.0 briefs wrote:** `::concurso` → `::titulo` (lines ranked by `#`
instead of labels), `::versao` → `::lamina` with `::apelo` (parts instead of `Oferta:`,
`Desconto:`, `Prazo:` labels), `Aprovação:` → `::nota`, `foto:` → `imagem:`. A 0.2.0 brief
gets `E_UNKNOWN_SLOT` at each old name.

## What it may reach

| Permission        | Why                                                            |
| ----------------- | -------------------------------------------------------------- |
| `font:CircularXX` | The words are set and measured in CircularXX, a licensed face. |

**The install asks for it once.** Faces Tyto ships cross to a plugin freely; a face installed
on the machine crosses only under this permission. On a machine without CircularXX, Tyto
measures and draws its bundled substitute and needs no permission.

## What a configuration may change

`templates/anuncio/manifest.yaml` declares two kinds of choice:

- **The layouts, as slots.** `cabeca` (`vitrine`, `faixa`, `lateral`, `manchete`, `noturna`) and
  `oferta` (`cartao`, `dupla`, `lista`, `chamada`, `impacto`) are enum slots. A named variant is
  a configuration of the plugin file whose `brief.slots` defaults them, with an alias such as
  `anuncio-vitrine-cartao`; the brief may still write either one, and the brief wins.
- **The colours, as `values`** (Tyto ADR 0153): `destaque`, `fundo`, `texto` and `texto-faixa`.
  Each default is the constant the code falls back to, pinned by `tests/values.test.ts`. A
  brief's frontmatter may set them too, quoted (`destaque: '#e30613'`, Tyto ADR 0226), and wins
  over the configuration. A configuration changes a value, never which pieces appear or their
  order (Tyto ADR 0151).
- **Too little contrast is a warning, never a change.** The band's words on `destaque`, and
  `destaque` on `fundo`, are measured (WCAG 2, Tyto's `contrastRatio`); under 3:1, WCAG's floor
  for large text, the render reports `W_TEMPLATE_LOW_CONTRAST` and keeps the colours. A yellow
  accent warns on both pairs; the house red does not.

## Development

`pnpm check` runs Prettier, the type checker, ESLint and the tests; `pnpm build` writes
`dist/index.js`, one ES module with every `@tyto` import inlined, which is committed and which
CI rebuilds and compares.

The template depends on Tyto's published contract, held by GitHub Packages under the owner's
scope (Tyto ADR 0149) and aliased in `package.json`: `@tyto/template-kit`, `@tyto/house-style`
and `@tyto/core` are what it is drawn with, and `@tyto/plugin-api` is what loads it. The
committed `.npmrc` names the scope only. GitHub asks for a token with `read:packages` even for
public packages, and it goes in your user-level `~/.npmrc`:

```sh
gh auth refresh -s read:packages
echo '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' >> ~/.npmrc
NODE_AUTH_TOKEN=$(gh auth token) pnpm install
```

The tests, all without Tyto:

- `src/template.test.ts`: the composition's rules on the scene — both formats drawn, the `#`
  part in capitals under the `##` status and above the offer, a later unmarked line smaller,
  every text inside the page's margins, the card's three shapes (band on top, at the bottom, in
  the middle, each with its corners), no card without an `apelo`, a long band line shrunk to one
  line, a wrapped card title growing the card upward, a wrapped head line pushing the next one
  down, the panel rising for a long name, the divider and the note in place, and an overflow
  reported when the supporting lines grow into the card.
- `tests/examples.test.ts`: every example brief compiled as Tyto compiles them, through
  `@tyto/template-kit/testing` (Tyto ADR 0152), against the HTML in `tests/__snapshots__/`.
  Nothing is measured and faces are placeholders, so the snapshot moves when the composition
  does and not when a machine has another font.
- `tests/values.test.ts`: each declared default pinned to the one the code falls back to, and a
  colour set in a test found in the HTML.
- `tests/plugin.test.ts`: the built `dist/index.js`, loaded through
  `@tyto/plugin-api/testing` (Tyto ADR 0150), drawing `anuncio` in both formats across the
  isolation protocol.

The `contract` workflow runs every day against the newest published contract, past the ranges
`package.json` asks for, so a Tyto release that breaks this template turns it red before
somebody installs it.
