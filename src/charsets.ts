import data from './data/charsets.json';

export interface Group {
  id: string;
  label: string;
  cps: number[];
  children?: Group[];
}

const fromString = (s: string) => Array.from(s, (c) => c.codePointAt(0)!);

function range(from: number, to: number, skip: number[] = []): number[] {
  const out: number[] = [];
  for (let cp = from; cp <= to; cp++) if (!skip.includes(cp)) out.push(cp);
  return out;
}

function leaf(id: string, label: string, cps: number[]): Group {
  return { id, label, cps };
}

// A parent's codepoints are the sorted union of its children, so overlapping
// lists (Kyōiku ⊂ Jōyō ⊂ mostly JIS L1+L2) are counted once.
function parent(id: string, label: string, children: Group[]): Group {
  const union = new Set<number>();
  for (const c of children) for (const cp of c.cps) union.add(cp);
  return { id, label, cps: [...union].sort((a, b) => a - b), children };
}

const kyoikuGrades = Object.entries(data.kyoiku).map(([grade, chars]) =>
  leaf(`kyoiku-${grade}`, `Grade ${grade}`, fromString(chars)),
);

export const tree: Group[] = [
  parent('latin', 'Latin', [
    leaf('basic-latin', 'Basic Latin', range(0x21, 0x7e)),
    // U+00AD (soft hyphen) is an invisible format character.
    leaf('latin-1', 'Latin-1 Supplement', range(0xa1, 0xff, [0xad])),
  ]),
  parent('kana', 'Kana', [
    leaf('hiragana', 'Hiragana', range(0x3041, 0x309f, [0x3097, 0x3098])),
    leaf('katakana', 'Katakana', range(0x30a0, 0x30ff)),
  ]),
  parent('kanji', 'Japanese Kanji', [
    parent('kyoiku', 'Kyōiku', kyoikuGrades),
    leaf('joyo', 'Jōyō', fromString(data.joyo)),
    leaf('jis1', 'JIS Level 1', fromString(data.jis1)),
    leaf('jis2', 'JIS Level 2', fromString(data.jis2)),
    leaf('jis3', 'JIS Level 3', fromString(data.jis3)),
    leaf('jis4', 'JIS Level 4', fromString(data.jis4)),
  ]),
];

export const groupsById = new Map<string, Group>();
const parentOf = new Map<string, Group>();
(function index(groups: Group[], p?: Group) {
  for (const g of groups) {
    groupsById.set(g.id, g);
    if (p) parentOf.set(g.id, p);
    if (g.children) index(g.children, g);
  }
})(tree);

// Leaf-group labels each codepoint belongs to, for the detail panel.
export const memberships = new Map<number, string[]>();
for (const g of groupsById.values()) {
  if (g.children) continue;
  const p = parentOf.get(g.id);
  const label = p?.id === 'kyoiku' ? `Kyōiku · ${g.label}` : g.label;
  for (const cp of g.cps) {
    const list = memberships.get(cp);
    if (list) list.push(label);
    else memberships.set(cp, [label]);
  }
}
