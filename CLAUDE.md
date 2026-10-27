# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local, browser-only Japanese font coverage viewer (Vite + TypeScript, no framework). The user drops in a font. The app reports how many characters it supports from each set (Latin, Kana, Kyōiku/Jōyō/JIS Levels 1–4 kanji) and shows a Glyphs-App-style grid. Nothing is uploaded or fetched at runtime.

## Commands

- `npm run dev`: dev server.
- `npm run build`: runs `tsc` (typecheck only, `noEmit`) and then `vite build`. This is the only check; the project has no tests and no linter.
- `npm run charsets`: refetches the kanji lists from NightFurySL2001/cjktables and regenerates `src/data/charsets.json`. The JSON is committed; the app never fetches at runtime.

## Architecture

**Data flow:**
1. `font.ts` `loadFont()` parses the dropped file with fontkit to get `Set<number>` of cmap codepoints.
2. It also registers the same bytes as a `FontFace` under a unique family (`UserFontN`) so real glyphs render.
3. `main.ts` holds all app state in one `state` object. It re-renders the sidebar, toolbar, grid, and detail panel through the `render*` functions. No reactivity library.

**Character sets (`charsets.ts`):** a `Group` tree.
- Leaf groups hold codepoint arrays.
- `parent()` sets a parent's `cps` to the sorted **union** of its children, because the lists overlap (Kyōiku ⊂ Jōyō ⊂ mostly JIS L1+L2). Parent totals must stay unions, never sums.
- Kyōiku is itself a parent of Grade 1–6 leaves.
- `memberships` maps codepoint to leaf labels for the detail panel.
- To add a set (e.g. `jinmeiyo.txt`, `kanken.txt`), add it to `FILES` in `scripts/build-charsets.mjs`, rerun `npm run charsets`, and add a leaf in `tree`.

**Grid (`grid.ts`):** hand-rolled virtualization.
- `relayout()` flattens sections into absolutely positioned header/row items with precomputed `top`.
- `render()` binary-searches the visible range and rebuilds only those rows as an HTML string.
- When a selected group has children, the grid shows one section per child, one level deep only.

**Invariants:**
- **Codepoints, not UTF-16 units:** JIS L3/L4 and Jōyō include non-BMP kanji (e.g. 𠮟 U+20B9F). Always iterate with `Array.from`/`codePointAt`/`String.fromCodePoint`.
- **TTC faces:** browsers render only the first face of a collection, so `extractTtcFace()` rebuilds the selected face as a standalone sfnt before handing it to `FontFace`. Coverage comes from fontkit's per-face `characterSet`.
- **Unrenderable fonts:** if `FontFace.load()` fails, coverage is still shown (`family: null`, `renderError` set).
- **Cell states:** a cell is `neutral` (no font loaded), `supported` (drawn in the user font), or `missing` (drawn in the `--fallback` system font stack, grayed, red marker).

## Verifying UI changes

There is no test harness. To check behavior, load macOS system fonts:
- `/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc`: full JIS X 0213 coverage, so every set should read 100%.
- `/System/Library/Fonts/Hiragino Sans GB.ttc`: Chinese; Jōyō reads 2,135/2,136 (missing U+20B9F), JIS L3/L4 partial.
