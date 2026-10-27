// Fetches the Japanese kanji lists from NightFurySL2001/cjktables and writes
// src/data/charsets.json. Run once with `npm run charsets`; the output is committed.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/NightFurySL2001/cjktables/master/japan/';
const FILES = {
  kyoiku: 'kyoiku.txt',
  joyo: 'joyokanji.txt',
  jis1: 'jis-lv1.txt',
  jis2: 'jis-lv2.txt',
  jis3: 'jis-lv3.txt',
  jis4: 'jis-lv4.txt',
};

async function parse(file) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const rows = [];
  for (const line of (await res.text()).split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [, hex, tag] = line.split('\t');
    rows.push({ cp: parseInt(hex, 16), tag: tag?.trim() });
  }
  return rows;
}

const toStr = (rows) => String.fromCodePoint(...rows.map((r) => r.cp));

const out = {};
for (const [key, file] of Object.entries(FILES)) {
  const rows = await parse(file);
  if (key === 'kyoiku') {
    out.kyoiku = {};
    for (const r of rows) (out.kyoiku[r.tag] ??= []).push(r);
    for (const g of Object.keys(out.kyoiku)) out.kyoiku[g] = toStr(out.kyoiku[g]);
  } else {
    out[key] = toStr(rows);
  }
  console.log(key, rows.length);
}

await writeFile(new URL('../src/data/charsets.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
