import type { Group } from './charsets';

export interface TreeState {
  selectedId: string;
  collapsed: Set<string>;
  supported: Set<number> | null;
}

export function countSupported(g: Group, supported: Set<number>): number {
  let n = 0;
  for (const cp of g.cps) if (supported.has(cp)) n++;
  return n;
}

export function renderTree(root: HTMLElement, groups: Group[], state: TreeState) {
  root.innerHTML = renderNodes(groups, state);
}

function renderNodes(groups: Group[], state: TreeState): string {
  return groups
    .map((g) => {
      const total = g.cps.length;
      const n = state.supported ? countSupported(g, state.supported) : null;
      const pct = n === null ? 0 : (n / total) * 100;
      const collapsed = state.collapsed.has(g.id);
      const caret = g.children
        ? `<button class="caret${collapsed ? '' : ' open'}" data-toggle="${g.id}" aria-label="Toggle"></button>`
        : '<span></span>';
      const count =
        n === null
          ? `<span class="count">${total.toLocaleString()}</span>`
          : `<span class="count${n === total ? ' complete' : ''}">${n.toLocaleString()} / ${total.toLocaleString()}</span>`;
      const bar = n === null ? '' : `<span class="bar${n === total ? ' complete' : ''}"><i style="width:${pct}%"></i></span>`;
      const children =
        g.children && !collapsed ? `<div class="children">${renderNodes(g.children, state)}</div>` : '';
      return (
        `<div class="node${g.id === state.selectedId ? ' selected' : ''}" data-id="${g.id}">` +
        `${caret}<span class="label">${g.label}</span>${count}${bar}</div>${children}`
      );
    })
    .join('');
}
