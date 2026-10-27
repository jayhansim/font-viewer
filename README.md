# Font Viewer

A local web tool for checking how much of each Japanese character set a font covers:
Latin, Kana (Hiragana and Katakana), and kanji by Kyōiku (with a per-grade breakdown), Jōyō, and JIS Levels 1–4.
Everything stays in the browser. The font is never uploaded.

```sh
npm install
npm run dev      # then open the printed URL and drop a .ttf/.otf/.ttc/.woff/.woff2
```

- Parent totals (Latin, Kana, Japanese Kanji) count each codepoint once, since the kanji lists overlap.
- Use **Missing** to filter the grid, and **Copy missing** to put the current group's missing characters on the clipboard.
- For collections (.ttc), choose a face from the dropdown under the font name.

Kanji lists come from [NightFurySL2001/cjktables](https://github.com/NightFurySL2001/cjktables/tree/master/japan).
`npm run charsets` refetches them into `src/data/charsets.json`.
