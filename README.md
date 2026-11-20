# tyto-template-anuncio

`anuncio`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its own repository:
a remarketing ad for one exam, its facts at the head and an offer below, in a feed post
(1080×1350) and a story (1080×1920). It belongs to Tyto's E18 (TYTO-803, Tyto ADR 0151): a
template that lives, is tested and is released here, with no pull request in Tyto's repository.

**This repository holds the composition only.** The logo is not here: Tyto hands it to the
template from the brand kit installed on the machine, and without one it draws a placeholder
(Tyto ADR 0063, ADR 0065). The example briefs are invented copy.

**One layout is drawn so far: `vitrine` with `cartao`.** The photograph fills the top; a panel
with rounded corners rises over it with the status line, the exam's name in capitals, the
supporting lines and the salary, then the offer card (a title, a band in the accent, a foot),
the proof of approvals and the logo. Its numbers are a reference art's layers, and they are
the least each piece gets: a line that wraps pushes the lines under it down, a card title that
wraps grows the card upward, a proof that wraps lifts the card, and the panel rises over the
photograph to make the room. Only the logo never moves; past half the panel's height the head
is reported as an overflow. The other heads
and offers named below are declared and draw this one until they arrive, with the kit pieces
they consume (Tyto TYTO-797 to TYTO-801).

In `::concurso`, lines with no label are, in order, the status line, the exam's name and
supporting lines; `Vagas:` and `Banca:` share one supporting line; `Salário:` is the salary line
and `Aprovação:` the proof under the card. In `::versao`, `Oferta:` is the card's title,
`Desconto:` or `Destaque:` its band, and `Prazo:`, `Garantia:` or `Cupom:` its foot. `**…**` is
bold wherever it is written.

## Install into Tyto

```
tyto plugin install git+https://github.com/rafaelsilvalor/tyto-template-anuncio.git
```

Tyto clones the default branch and never builds it, so `dist/index.js` is committed on `main`
and every release is a tag of it. To take a change pushed here, run the same command again:
installing a name that is already installed replaces it.

A pack brings templates and no formats. Copy `templates/formats.yaml` into the project that
renders `anuncio`, or merge its `grid` and `story` lines into the project's own. Then a brief
writes the exam once and one `::versao` per artwork:

```
---
template: anuncio
formats: [grid, story]
---
::concurso
  Edital publicado
  Concurso QC Regula
  Vagas: 40

::versao
  Oferta: Lote Especial
  Desconto: Pacotes com **40% OFF**

::versao
  Oferta: Pacote Completo
  Garantia: 7 dias de garantia
```

Two versions in two formats are four images. `foto:` and `recorte:` in the frontmatter name the
head's photograph and a teacher cut out with no background.

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

- `src/template.test.ts`: the composition's rules on the scene — both formats drawn, the exam's
  name in capitals above the offer, every text inside the page's margins, a long band line
  shrunk to one line, a wrapped head line pushing the next one down, a wrapped card title
  growing the card upward, the panel rising for a long name, and an overflow reported when the
  supporting lines grow into the card.
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
