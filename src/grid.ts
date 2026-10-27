export interface Section {
  title?: string;
  cps: number[];
}

export interface GridOptions {
  cellSize: number;
  fontFamily: string | null;
  /** null when no font is loaded: cells render neutrally. */
  supported: Set<number> | null;
  selected: number | null;
}

type Item =
  | { kind: 'header'; top: number; title: string }
  | { kind: 'row'; top: number; cps: number[] };

const HEADER_HEIGHT = 44;
const PADDING = 24;
const OVERSCAN = 400;

export const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Virtualized glyph grid: only the rows near the viewport exist in the DOM. */
export class Grid {
  private canvas = document.createElement('div');
  private items: Item[] = [];
  private height = 0;
  private sections: Section[] = [];
  private opts!: GridOptions;
  private rendered = '';

  constructor(
    private scroller: HTMLElement,
    onSelect: (cp: number) => void,
  ) {
    this.canvas.className = 'grid-canvas';
    scroller.append(this.canvas);
    scroller.addEventListener('scroll', () => requestAnimationFrame(() => this.render()));
    new ResizeObserver(() => this.relayout()).observe(scroller);
    this.canvas.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.cell');
      if (cell) onSelect(Number(cell.dataset.cp));
    });
  }

  update(sections: Section[], opts: GridOptions, resetScroll: boolean) {
    this.sections = sections;
    this.opts = opts;
    if (resetScroll) this.scroller.scrollTop = 0;
    this.relayout();
  }

  private relayout() {
    if (!this.opts) return;
    const size = this.opts.cellSize;
    const cols = Math.max(1, Math.floor((this.scroller.clientWidth - PADDING * 2) / size));
    const items: Item[] = [];
    let top = PADDING;
    for (const s of this.sections) {
      if (s.title) {
        items.push({ kind: 'header', top, title: s.title });
        top += HEADER_HEIGHT;
      }
      for (let i = 0; i < s.cps.length; i += cols) {
        items.push({ kind: 'row', top, cps: s.cps.slice(i, i + cols) });
        top += size;
      }
      top += 16;
    }
    this.items = items;
    this.height = top + PADDING;
    this.canvas.style.height = `${this.height}px`;
    this.rendered = '';
    this.render();
  }

  private render() {
    const { cellSize: size, fontFamily, supported, selected } = this.opts;
    const viewTop = this.scroller.scrollTop - OVERSCAN;
    const viewBottom = this.scroller.scrollTop + this.scroller.clientHeight + OVERSCAN;

    // Binary search for the first item that ends below the top of the view.
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const it = this.items[mid];
      const bottom = it.top + (it.kind === 'header' ? HEADER_HEIGHT : size);
      if (bottom < viewTop) lo = mid + 1;
      else hi = mid;
    }

    const glyphFont = fontFamily ? `font-family:'${fontFamily}';` : '';
    const fontSize = `font-size:${Math.round(size * 0.5)}px`;
    let html = '';
    for (let i = lo; i < this.items.length && this.items[i].top < viewBottom; i++) {
      const it = this.items[i];
      if (it.kind === 'header') {
        html += `<div class="section-header" style="top:${it.top}px">${escapeHtml(it.title)}</div>`;
        continue;
      }
      html += `<div class="row" style="top:${it.top}px;height:${size}px">`;
      for (const cp of it.cps) {
        const state = !supported ? 'neutral' : supported.has(cp) ? 'supported' : 'missing';
        const sel = cp === selected ? ' selected' : '';
        html +=
          `<div class="cell ${state}${sel}" data-cp="${cp}" style="width:${size}px" title="U+${hex(cp)}">` +
          `<span class="glyph" style="${state === 'supported' ? glyphFont : ''}${fontSize}">` +
          `${escapeHtml(String.fromCodePoint(cp))}</span><span class="code">${hex(cp)}</span></div>`;
      }
      html += '</div>';
    }

    if (html !== this.rendered) {
      this.canvas.innerHTML = html;
      this.rendered = html;
    }
  }
}
