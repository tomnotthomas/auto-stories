import { Component, computed, input } from '@angular/core';
import type { Layout } from '@auto-stories/api-types';

import { paletteFor } from '../../../story/caption-palette';
import { resolveLayout, type ResolvedElement } from '../../../story/layout-spec';

/** On-screen base caption size (px); the canvas export uses 64 at 1080px wide, a
 * ~2.7× scale that matches this so the preview and the export read the same. */
const LAYOUT_DOM_BASE_PX = 24;

/**
 * The DOM half of the shared spec renderer (decision 7.21). Draws a frame's
 * {@link Layout} in the story preview by resolving it with `resolveLayout` — the
 * same resolution the canvas export uses (`drawLayout`) — so the preview and the
 * exported image never drift. Colour comes from the frame's device-computed
 * `light`/`legibility` (7.10); the element only decides type + placement.
 */
@Component({
  selector: 'app-layout-view',
  templateUrl: './layout-view.html',
  host: { class: 'absolute inset-0' },
})
export class LayoutView {
  readonly layout = input.required<Layout>();
  /** true → light (white) text, false → dark. */
  readonly light = input(true);
  /** true → draw a scrim behind each element for legibility. */
  readonly legibility = input(false);

  protected readonly elements = computed<ResolvedElement[]>(() => resolveLayout(this.layout()));

  protected readonly color = computed(() => {
    const palette = paletteFor();
    return this.light() ? palette.textLight : palette.textDark;
  });

  protected readonly scrimClass = computed(() =>
    this.legibility() ? (this.light() ? 'bg-black/40' : 'bg-white/60') : '',
  );

  protected fontPx(element: ResolvedElement): number {
    return LAYOUT_DOM_BASE_PX * element.sizeScale;
  }

  /** Shift the box so its anchor corner (h/v align) sits on the (x, y) point. */
  protected translate(element: ResolvedElement): string {
    const hx = element.hAlign === 'left' ? '0' : element.hAlign === 'right' ? '-100%' : '-50%';
    const vy = element.vAlign === 'top' ? '0' : element.vAlign === 'bottom' ? '-100%' : '-50%';
    return `translate(${hx}, ${vy})`;
  }
}
