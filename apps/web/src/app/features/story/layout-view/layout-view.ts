import { Component, computed, input } from '@angular/core';
import type { Layout } from '@auto-stories/api-types';

import { paletteFor } from '../../../story/caption-palette';
import type { Readable } from '../../../story/caption-style';
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
  /** Per-element readability, computed on-device (7.10). Falls back to the
   * frame-level `light`/`legibility` for any element not yet sampled. */
  readonly readable = input<readonly Readable[] | undefined>(undefined);
  /** Frame-level fallback: true → light (white) text, false → dark. */
  readonly light = input(true);
  /** Frame-level fallback: true → draw a scrim behind each element. */
  readonly legibility = input(false);

  protected readonly elements = computed<ResolvedElement[]>(() => resolveLayout(this.layout()));

  /** Legible colour for element `index`, from its own sampled luminance if we
   * have it, else the frame-level fallback. */
  protected colorFor(index: number): string {
    const palette = paletteFor();
    const isLight = this.readable()?.[index]?.light ?? this.light();
    return isLight ? palette.textLight : palette.textDark;
  }

  /** Scrim class for element `index`, or '' when no scrim is needed. */
  protected scrimClassFor(index: number): string {
    const r = this.readable()?.[index];
    const isLight = r?.light ?? this.light();
    const scrim = r?.scrim ?? this.legibility();
    return scrim ? (isLight ? 'bg-black/40' : 'bg-white/60') : '';
  }

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
