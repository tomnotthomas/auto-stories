import { Component, computed, input } from '@angular/core';

import { paletteFor } from '../../../story/caption-palette';
import { PAPER, PAPER_INK, blockMarkHeightEm, handStroke } from '../../../story/look';
import type {
  Composition,
  Mark,
  Panel,
  Part,
  PartColor,
  RowPart,
  RulePart,
  Run,
  TagPart,
  TextPart,
} from '../../../story/look';

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

/** Outline weight for stencilled type, as a fraction of the type size. */
const STROKE_EM = 0.028;

/** Box padding around a tag's label, in its own type size. */
const TAG_PADDING = '0.34em 0.62em';

/** How far each tag style tilts when the Look doesn't say — part of its character. */
const TAG_TILT: Record<TagPart['style'], number> = {
  pill: 0,
  chip: 0,
  tape: -2.2,
  stamp: -5,
};

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

  protected readonly tagPadding = TAG_PADDING;

  protected readonly parts = computed<readonly Part[]>(() => this.composition().parts);

  /**
   * The panel, once it has something to sit behind. A panel with no type would
   * draw as a bar floating on the photo, so it is dropped — as the export does.
   */
  private readonly panel = computed<Panel | null>(() => {
    const panel = this.composition().panel;
    return panel && this.parts().length > 0 ? panel : null;
  });

  /**
   * A panel is the stack's own box — its background, its padding, its radius —
   * rather than a second element measured against it. That is why the column's
   * insets move OUT by the padding: the composition's insets place the type, so
   * the box that backs it starts a padding earlier, which is exactly where the
   * canvas half puts the rectangle it measures around the drawn stack.
   *
   * A full-width panel runs to the frame edge instead, and the type keeps its
   * own insets as the panel's padding.
   */
  protected readonly columnLeft = computed<string>(() => this.columnInset('left'));
  protected readonly columnRight = computed<string>(() => this.columnInset('right'));

  protected readonly columnPadding = computed<string | null>(() => {
    const panel = this.panel();
    if (!panel) return null;
    const composition = this.composition();
    const left = panel.fullWidth ? composition.leftPct : panel.padWPct;
    const right = panel.fullWidth ? composition.rightPct : panel.padWPct;
    return `${panel.padHPct}cqh ${right}cqw ${panel.padHPct}cqh ${left}cqw`;
  });

  /** The panel's fill. Its opacity is mixed into the colour, not applied to the
   * box, so the type on top stays fully opaque. */
  protected readonly panelBackground = computed<string | null>(() => {
    const panel = this.panel();
    if (!panel) return null;
    const color = this.paint(panel.color);
    const opacity = clamp01(panel.opacity);
    return opacity >= 1
      ? color
      : `color-mix(in srgb, ${color} ${(opacity * 100).toFixed(1)}%, transparent)`;
  });

  protected readonly panelRadius = computed<string | null>(() => {
    const panel = this.panel();
    return panel ? `${panel.radiusWPct}cqw` : null;
  });

  /** Where the stack hangs from, in CSS, once the preview's chrome is allowed for. */
  protected readonly edgeOffset = computed<string>(() => {
    const composition = this.composition();
    const offset = `${composition.offsetHPct - (this.panel()?.padHPct ?? 0)}%`;
    const inset = this.safeBottomPx();
    return composition.anchor === 'bottom' && inset > 0 ? `calc(${offset} + ${inset}px)` : offset;
  });

  /** The tilt of the whole stack — a page laid down by hand, not typeset. The
   * box being rotated is the panel when there is one, so panel and type turn
   * together about the same centre the export pivots on. */
  protected readonly stackTilt = computed<number | null>(() =>
    tilt(this.composition().rotationDeg),
  );

  protected readonly stackTransform = computed<string | null>(() => {
    const deg = this.stackTilt();
    return deg === null ? null : `rotate(${deg}deg)`;
  });

  /**
   * The inset frame drawn on the photo. The canvas half strokes centred on its
   * path while a CSS border draws inside its box, so the box moves out by half
   * the stroke — and its radius grows by the same — for the two to land on one
   * line.
   */
  protected readonly borderBox = computed(() => {
    const border = this.composition().border;
    if (!border) return null;
    const half = border.widthWPct / 2;
    return {
      inset: `${round(border.insetWPct - half)}cqw`,
      stroke: `${border.widthWPct}cqw solid ${this.paint(border.color)}`,
      radius: `${round(border.radiusWPct + half)}cqw`,
    };
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

  protected isTag(part: Part): part is TagPart {
    return part.kind === 'tag';
  }

  /** The legible ink colour: the Look's own polarity, or the sampled one (7.10). */
  protected get ink(): string {
    const palette = paletteFor();
    const declared = this.composition().ink;
    const isLight = declared === 'auto' ? this.light() : declared === 'light';
    return isLight ? palette.textLight : palette.textDark;
  }

  protected colorFor(part: TextPart | RowPart | RulePart | TagPart): string {
    return this.paint(part.color);
  }

  /** The accent, falling back to the ink so a part is never invisible. */
  protected get accentColor(): string {
    return this.accent() ?? this.ink;
  }

  /** Stencilled type is an outline with nothing inside it. */
  protected textFill(part: TextPart): string {
    return part.stroke ? 'transparent' : this.colorFor(part);
  }

  protected textStroke(part: TextPart): string | null {
    return part.stroke ? `${STROKE_EM}em ${this.colorFor(part)}` : null;
  }

  /** Which mark this run carries, if any — the DOM's record of what was drawn. */
  protected markName(part: TextPart, run: Run): Mark | null {
    return run.emphasised && part.mark ? part.mark : null;
  }

  /** `.head u` — the accent bar riding the baseline of an emphasised phrase.
   * Null for a plain run, so the template can bind it unconditionally and avoid
   * an @if that would inject whitespace into the words — which is why every
   * mark below is a style on the run rather than an element inside it. */
  protected markBar(part: TextPart, run: Run): string | null {
    return this.markName(part, run) === 'accent-underline'
      ? `inset 0 -0.1em 0 ${this.accentColor}`
      : null;
  }

  /** The three marks that paint behind the word rather than under its baseline. */
  protected markBackground(part: TextPart, run: Run): string | null {
    const accent = this.accentColor;
    switch (this.markName(part, run)) {
      case 'accent-block':
        // Painted as a sized background rather than a plain fill: an inline
        // background covers the font's whole content area (~1.16em), which is
        // taller than the line a marked headline is set on, so the block used
        // to ride up over the line above. Sized off the line, it cannot.
        return (
          `linear-gradient(${accent}, ${accent}) no-repeat center / ` +
          `100% ${blockMarkHeightEm(part.lineHeight)}em`
        );
      case 'highlighter': {
        // A marker swipe: thick, translucent, struck through the middle of the
        // word rather than sitting under it.
        const wash = `color-mix(in srgb, ${accent} 42%, transparent)`;
        return `linear-gradient(to bottom, transparent 28%, ${wash} 28%, ${wash} 82%, transparent 82%)`;
      }
      case 'hand-underline':
        return `${handStrokeImage(run.text, accent)} no-repeat left bottom / 100% 0.3em`;
      default:
        return null;
    }
  }

  /** Air around a mark: room inside the block, the overshoot a real pen leaves. */
  protected markPadding(part: TextPart, run: Run): string | null {
    switch (this.markName(part, run)) {
      case 'accent-block':
        // Air on the sides only — the block's height is its background's.
        return '0 0.14em';
      case 'highlighter':
        return '0 0.08em';
      case 'hand-underline':
        return '0 0 0.14em';
      default:
        return null;
    }
  }

  /** A block mark covers the run, so the type reverses out of it. */
  protected markInk(part: TextPart, run: Run): string | null {
    return this.markName(part, run) === 'accent-block' ? PAPER : null;
  }

  /** A marked phrase that wraps gets its mark redrawn on the second line —
   * which is what the export does, drawing each line's runs on their own. */
  protected markClip(part: TextPart, run: Run): string | null {
    return this.markName(part, run) ? 'clone' : null;
  }

  protected tagTransform(part: TagPart): string | null {
    const deg = tilt(part.rotationDeg ?? TAG_TILT[part.style]);
    return deg === null ? null : `rotate(${deg}deg)`;
  }

  /** Tape is a strip of paper; a chip is a solid accent lozenge. The outlined
   * styles have no fill — the outline is the whole graphic. */
  protected tagBackground(part: TagPart): string | null {
    if (part.style === 'tape') return PAPER;
    return part.style === 'chip' ? this.accentColor : null;
  }

  protected tagInk(part: TagPart): string {
    switch (part.style) {
      case 'tape':
        return PAPER_INK;
      case 'chip':
        return PAPER;
      case 'stamp':
        return this.accentColor;
      default:
        return this.colorFor(part);
    }
  }

  protected tagBorder(part: TagPart): string | null {
    if (part.style === 'pill') return `0.075em solid ${this.colorFor(part)}`;
    return part.style === 'stamp' ? `0.1em solid ${this.accentColor}` : null;
  }

  protected tagRadius(part: TagPart): string {
    switch (part.style) {
      case 'pill':
        // A capsule: the radius is whatever half the box turns out to be.
        return '999px';
      case 'chip':
        return `${round(0.38 * (part.lineHeight + 0.68))}em`;
      case 'tape':
        return '0.12em';
      default:
        return '0.18em';
    }
  }

  /** Tape is laid ON the photo; without a shadow it reads as printed into it. */
  protected tagShadow(part: TagPart): string | null {
    return part.style === 'tape' ? '0 0.12em 0.5em rgba(0, 0, 0, 0.28)' : null;
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

  private columnInset(edge: 'left' | 'right'): string {
    const composition = this.composition();
    const inset = edge === 'left' ? composition.leftPct : composition.rightPct;
    const panel = this.panel();
    if (!panel) return `${inset}cqw`;
    return panel.fullWidth ? '0cqw' : `${round(inset - panel.padWPct)}cqw`;
  }

  private paint(color: PartColor): string {
    if (color === 'accent') return this.accentColor;
    return color === 'paper' ? PAPER : this.ink;
  }
}

/** The angle to turn something by, or null when there is nothing to turn. */
function tilt(degrees: number | undefined): number | null {
  return degrees && Number.isFinite(degrees) ? round(degrees) : null;
}

/**
 * One loose bezier that sags, lifts and overshoots, with each end at its own
 * height — a stroke that reads as drawn rather than typeset. It rides in as a
 * background image so an emphasised run stays a single span: an element inside
 * the run would need an `@if`, and template whitespace lands inside the words.
 *
 * The wobble is a hash of the word, so a given word always wobbles the same way
 * and a redraw never makes the line twitch.
 */
function handStrokeImage(seed: string, color: string): string {
  // The shape comes from the shared `handStroke` so the same word bends the same
  // way here and in the export; the viewBox below is only how we scale it. The
  // two halves each had their own constants when they were written in parallel,
  // which quietly broke the promise that a preview matches its PNG.
  const stroke = handStroke(seed);
  const MID = 8.5;
  const startY = MID + stroke.startY * 14;
  const endY = MID + stroke.endY * 14;
  const sag = stroke.sag * 14;
  const lift = stroke.lift * 14;
  const path = `M1 ${round(startY)} C30 ${round(startY + sag)} 66 ${round(endY - lift)} 99 ${round(
    endY,
  )}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 14" preserveAspectRatio="none">` +
    `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/** Trim the float noise that percentage arithmetic leaves in the CSS. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
