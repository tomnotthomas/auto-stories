import { Component, computed, input } from '@angular/core';

import { paletteFor } from '../../../story/caption-palette';
import type { Composition, Part, RowPart, RulePart, Run, TextPart } from '../../../story/look';

/**
 * The DOM half of the Looks renderer (decision 7.24). Draws the same
 * {@link Composition} the canvas export draws (`drawComposition`), so the
 * preview and the exported PNG never drift.
 *
 * The Looks author their geometry as percentages of the frame — width for type
 * sizes, height for vertical rhythm — which is exactly what container-query
 * units mean. Declaring `container-type: size` on the host lets the browser do
 * that arithmetic natively, so this template stays a direct transcription of the
 * approved mockups instead of a second, drifting implementation of their maths.
 *
 * Colour is not decided here: parts declare `ink` or `accent`, and `ink` resolves
 * to the legible white/dark computed from the pixels behind the type (7.10).
 */
@Component({
  selector: 'app-layout-view',
  templateUrl: './layout-view.html',
  host: { class: 'absolute inset-0 overflow-hidden', '[style.containerType]': "'size'" },
})
export class LayoutView {
  readonly composition = input.required<Composition>();
  /** The story accent, sampled from the photo (7.23). */
  readonly accent = input<string | undefined>(undefined);
  /** true → light (white) type, false → dark; computed on-device (7.10). */
  readonly light = input(true);
  /**
   * Chrome overlaying the bottom of the preview (the action bar) that the
   * exported PNG does not have. A Look's offset is measured from the bottom of
   * the *usable* frame, so the preview adds this and the export passes nothing —
   * otherwise a bottom-anchored masthead renders correctly at 1080×1920 and sits
   * behind the buttons on screen (the same trap as the caption fix, 7c9df88).
   */
  readonly safeBottomPx = input(0);

  protected readonly parts = computed<readonly Part[]>(() => this.composition().parts);

  /** Where the stack hangs from, in CSS, once the preview's chrome is allowed for. */
  protected readonly edgeOffset = computed<string>(() => {
    const offset = `${this.composition().offsetHPct}%`;
    const inset = this.safeBottomPx();
    return this.composition().anchor === 'bottom' && inset > 0
      ? `calc(${offset} + ${inset}px)`
      : offset;
  });

  protected isText(part: Part): part is TextPart {
    return part.kind === 'text';
  }

  protected isRule(part: Part): part is RulePart {
    return part.kind === 'rule';
  }

  protected isRow(part: Part): part is RowPart {
    return part.kind === 'row';
  }

  /** The legible ink colour: the Look's own polarity, or the sampled one (7.10). */
  protected get ink(): string {
    const palette = paletteFor();
    const declared = this.composition().ink;
    const isLight = declared === 'auto' ? this.light() : declared === 'light';
    return isLight ? palette.textLight : palette.textDark;
  }

  protected colorFor(part: TextPart | RowPart | RulePart): string {
    return part.color === 'accent' ? this.accentColor : this.ink;
  }

  /** The accent, falling back to the ink so a part is never invisible. */
  protected get accentColor(): string {
    return this.accent() ?? this.ink;
  }

  /** `.head u` — the accent bar riding the baseline of an emphasised phrase.
   * Null for a plain run, so the template can bind it unconditionally and avoid
   * an @if that would inject whitespace into the words. */
  protected markFor(part: TextPart, run: Run): string | null {
    if (!run.emphasised || part.mark !== 'accent-underline') return null;
    return `inset 0 -0.1em 0 ${this.accentColor}`;
  }

  /** The gradient that keeps type readable over an unknown photo. */
  protected get scrimStyle(): string | null {
    const scrim = this.composition().scrim;
    if (!scrim) return null;
    const direction = scrim.from === 'bottom' ? 'to top' : 'to bottom';
    return `linear-gradient(${direction}, rgba(0,0,0,${scrim.strength}) 0%, rgba(0,0,0,${(
      scrim.strength * 0.38
    ).toFixed(2)}) 34%, transparent 62%)`;
  }
}
