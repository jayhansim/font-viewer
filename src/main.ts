import './styles.css';
import { groupsById, memberships, tree } from './charsets';
import { loadFont, type LoadedFont } from './font';
import { Grid, hex, type Section } from './grid';
import { countSupported, renderTree } from './sidebar';

type Filter = 'all' | 'supported' | 'missing';

const state = {
  font: null as LoadedFont | null,
  fontBuffer: null as ArrayBuffer | null,
  groupId: 'kanji',
  collapsed: new Set(['kyoiku']),
  filter: 'all' as Filter,
  cellSize: 64,
  selected: null as number | null,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const els = {
  fileInput: $<HTMLInputElement>('file-input'),
  fontName: $('font-name'),
  fontMeta: $('font-meta'),
  faceSelect: $<HTMLSelectElement>('face-select'),
  fontError: $('font-error'),
  tree: $('tree'),
  groupTitle: $('group-title'),
  groupCount: $('group-count'),
  filter: $('filter'),
  cellSize: $<HTMLInputElement>('cell-size'),
  copyMissing: $<HTMLButtonElement>('copy-missing'),
  empty: $('empty'),
  detail: $('detail'),
  dropOverlay: $('drop-overlay'),
};

const grid = new Grid($('grid'), (cp) => {
  state.selected = state.selected === cp ? null : cp;
  renderGrid(false);
  renderDetail();
});

// --- Rendering -------------------------------------------------------------

function applyFilter(cps: number[]): number[] {
  const s = state.font?.supported;
  if (!s || state.filter === 'all') return cps;
  const want = state.filter === 'supported';
  return cps.filter((cp) => s.has(cp) === want);
}

function renderSidebar() {
  renderTree(els.tree, tree, {
    selectedId: state.groupId,
    collapsed: state.collapsed,
    supported: state.font?.supported ?? null,
  });
}

function renderGrid(resetScroll: boolean) {
  const group = groupsById.get(state.groupId)!;
  const sections: Section[] = (group.children ?? [group]).map((g) => {
    const cps = applyFilter(g.cps);
    const title = group.children ? `${g.label} · ${cps.length.toLocaleString()}` : undefined;
    return { title, cps };
  });

  grid.update(
    sections,
    {
      cellSize: state.cellSize,
      fontFamily: state.font?.family ?? null,
      supported: state.font?.supported ?? null,
      selected: state.selected,
    },
    resetScroll,
  );

  const shown = sections.reduce((n, s) => n + s.cps.length, 0);
  els.empty.hidden = shown > 0;
  els.empty.textContent =
    state.filter === 'missing' ? 'Nothing missing — this font covers the whole set.' : 'No characters to show.';
}

function renderToolbar() {
  const group = groupsById.get(state.groupId)!;
  const total = group.cps.length;
  els.groupTitle.textContent = group.label;
  if (state.font) {
    const n = countSupported(group, state.font.supported);
    els.groupCount.textContent = `${n.toLocaleString()} / ${total.toLocaleString()} supported (${(Math.floor((n / total) * 1000) / 10).toFixed(1)}%)`;
  } else {
    els.groupCount.textContent = `${total.toLocaleString()} characters`;
  }
  for (const b of els.filter.querySelectorAll<HTMLButtonElement>('button')) {
    b.classList.toggle('active', b.dataset.filter === state.filter);
    b.disabled = !state.font && b.dataset.filter !== 'all';
  }
  els.copyMissing.disabled = !state.font;
}

function renderFontInfo() {
  const f = state.font;
  els.fontName.textContent = f ? `${f.name} ${f.style}` : 'No font loaded';
  els.fontName.classList.toggle('muted', !f);
  els.fontMeta.textContent = f
    ? [f.version, `${f.glyphCount.toLocaleString()} glyphs`, `${f.supported.size.toLocaleString()} characters`]
        .filter(Boolean)
        .join(' · ')
    : '';
  els.fontError.hidden = !f?.renderError;
  els.fontError.textContent = f?.renderError ?? '';
  els.faceSelect.hidden = !f?.faces || f.faces.length < 2;
  if (f?.faces) {
    els.faceSelect.innerHTML = f.faces.map((name, i) => `<option value="${i}">${name}</option>`).join('');
    els.faceSelect.value = String(f.faceIndex);
  }
}

function renderDetail() {
  const cp = state.selected;
  els.detail.hidden = cp === null;
  if (cp === null) return;
  const char = String.fromCodePoint(cp);
  const f = state.font;
  const supported = f?.supported.has(cp);
  const status = !f ? '' : supported ? '<span class="tag ok">Supported</span>' : '<span class="tag no">Missing</span>';
  const fontStyle = supported && f?.family ? ` style="font-family:'${f.family}'"` : '';
  const groups = memberships.get(cp) ?? [];
  els.detail.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <div class="big${f && !supported ? ' missing' : ''}"${fontStyle}></div>
    <div class="detail-row"><span class="code-big">U+${hex(cp)}</span>${status}</div>
    <dl>
      <dt>Character</dt><dd class="char"></dd>
      <dt>Decimal</dt><dd>${cp}</dd>
      <dt>In sets</dt><dd>${groups.map((g) => `<div>${g}</div>`).join('') || '—'}</dd>
    </dl>
    <button class="button copy-char">Copy character</button>`;
  els.detail.querySelector('.big')!.textContent = char;
  els.detail.querySelector('.char')!.textContent = char;
}

function renderAll(resetScroll = false) {
  renderFontInfo();
  renderSidebar();
  renderToolbar();
  renderGrid(resetScroll);
  renderDetail();
}

// --- Font loading ----------------------------------------------------------

async function openFile(file: File) {
  try {
    state.fontBuffer = await file.arrayBuffer();
    await useFace(0);
  } catch (e) {
    console.error(e);
    els.fontError.hidden = false;
    els.fontError.textContent = `Could not read “${file.name}”: ${(e as Error).message}`;
  }
}

async function useFace(index: number) {
  if (!state.fontBuffer) return;
  state.font = await loadFont(state.fontBuffer, index);
  renderAll();
}

// --- Events ----------------------------------------------------------------

els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files?.[0];
  if (file) openFile(file);
  els.fileInput.value = '';
});

els.faceSelect.addEventListener('change', () => useFace(Number(els.faceSelect.value)));

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (++dragDepth === 1) els.dropOverlay.hidden = false;
});
window.addEventListener('dragleave', () => {
  if (--dragDepth === 0) els.dropOverlay.hidden = true;
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.dropOverlay.hidden = true;
  const file = e.dataTransfer?.files[0];
  if (file) openFile(file);
});

els.tree.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const toggle = target.closest<HTMLElement>('[data-toggle]');
  if (toggle) {
    const id = toggle.dataset.toggle!;
    if (!state.collapsed.delete(id)) state.collapsed.add(id);
    renderSidebar();
    return;
  }
  const node = target.closest<HTMLElement>('.node');
  if (node && node.dataset.id !== state.groupId) {
    state.groupId = node.dataset.id!;
    renderSidebar();
    renderToolbar();
    renderGrid(true);
  }
});

els.filter.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b || b.disabled) return;
  state.filter = b.dataset.filter as Filter;
  renderToolbar();
  renderGrid(true);
});

els.cellSize.addEventListener('input', () => {
  state.cellSize = Number(els.cellSize.value);
  renderGrid(false);
});

els.copyMissing.addEventListener('click', async () => {
  const f = state.font;
  if (!f) return;
  const missing = groupsById.get(state.groupId)!.cps.filter((cp) => !f.supported.has(cp));
  await navigator.clipboard.writeText(String.fromCodePoint(...missing));
  els.copyMissing.textContent = `Copied ${missing.length.toLocaleString()}`;
  setTimeout(() => (els.copyMissing.textContent = 'Copy missing'), 1500);
});

els.detail.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('.close')) {
    state.selected = null;
    renderGrid(false);
    renderDetail();
  } else if (target.closest('.copy-char') && state.selected !== null) {
    navigator.clipboard.writeText(String.fromCodePoint(state.selected));
  }
});

renderAll(true);
