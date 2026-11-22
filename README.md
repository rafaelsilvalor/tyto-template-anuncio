# tyto-template-anuncio

`anuncio`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its own repository:
a remarketing ad for one exam, its facts at the head and an offer below, in a feed post
(1080×1350) and a story (1080×1920). It belongs to Tyto's E18 (TYTO-803, Tyto ADR 0151): a
template that lives, is tested and is released here, with no pull request in Tyto's repository.

**This repository holds the composition only.** The logo is not here: Tyto hands it to the
template from the brand kit installed on the machine, and without one it draws a placeholder
(Tyto ADR 0063, ADR 0065). The example briefs are invented copy.

**One layout is drawn so far: `vitrine` with `cartao`.** The photograph fills the top; a panel
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

- **`::titulo`**, once, is the head, ranked by its marks and read by the kit's `levelsOf`: `|`
  between the parts of a line; `#` the exam's name, in capitals and the accent; `##` before it
  the status line, after it the salary; `###` a stronger supporting line; an unmarked part a
  supporting line, or, before the name, a tracked label in the accent; a line of `---` the three
  dots. The first line with no mark is read by position; a later unmarked line is supporting.
- **`::corpo`** is the general information under the title — vacancies, exam board, roles,
  salary — in the same marks, as a block of its own (Tyto TYTO-832, the kit's `bodyBlock`): it
  keeps its sizes when the exam's name grows or shrinks to fit, and takes its own `peso`. Its
  first line is a fact, never a name. Shared before the slides or after `::comum`, a slide's own
  inside a `::lamina`. A brief with no `::corpo` draws every line in the title, as 0.4.0 did.
- **A line with no mark is the smallest**, in the title and in the body: the smallest marked
  size times 0.8 (`unmarkedRatio`), so `#`, `##` and `###` carry the weight.
- **`::lamina`**, one per artwork, then its **`::apelo`**: the card takes the shape of the
  line's parts. The main part is the band, the parts before it the title, the parts after it
  the foot, and the band takes the corners of the edge it reaches; the kit's `card` draws it.
  Band and title words shrink to one line before they wrap, and a segment grows to hold them.
- **`::nota`** is the proof line, shared or a slide's own (Tyto ADR 0225). Written after
  `::comum`, which closes the slides, it is every artwork's and goes under the card; written
  inside a `::lamina` it is that artwork's only and replaces the shared one there. A note
  written before the first slide is every artwork's too, and is drawn **above** the card, since
  the brief is read top to bottom as the art.
- **`{peso: 1}`, `{peso: 3}`** on `::titulo`, `::apelo` or `::nota` draw that block at 0.85 or
  1.2 of its size (Tyto `docs/slot-vocabulary.md`, `peso`); the head never grows past the width
  its main line fills.

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
- **The colours, as `values`** (Tyto ADR 0153): `accent`, `paper` and `ink`. Each default is the
  constant the code falls back to, pinned by `tests/values.test.ts`. A configuration changes a
  value, never which pieces appear or their order (Tyto ADR 0151).

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
