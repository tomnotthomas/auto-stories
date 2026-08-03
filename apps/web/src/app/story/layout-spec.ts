import type { Style } from '@auto-stories/api-types';

import { fontFamily, fontWeightCss, textAlignCss, textTransformCss } from './caption-render';

/**
 * The layout spec — how the AI art-directs the type on one frame (decision 7.21).
 * A frame is a set of positioned {@link LayoutElement}s (a label, a title, a deck),
 * each with its own face, size, tracking, and place. `resolveLayout` turns a spec
 * into {@link ResolvedElement}s: type resolved to CSS values, positions clamped
 * into a safe area, and a neutral anchor/align both renderers can consume.
 *
 * This is the single source of truth for drawing. The DOM preview and the canvas
 * export both draw from `resolveLayout` output, so the two never drift.
 *
 *   LayoutSpec ──resolveLayout──▶ ResolvedElement[] ──┬─▶ DOM preview (absolute box + translate)
 *   (from the agent)                                  └─▶ canvas export (textAlign/textBaseline)
 *
 * Colour is NOT resolved here: it stays a device computation (7.10), layered on by
 * the renderer from the sampled pixels. This module owns geometry + type only.
 */

/** What the element is, so hierarchy reads even though placement is free. */
export type ElementRole = 'label' | 'title' | 'deck';

/** Which point of the element's box sits at (x, y). Drives align + baseline so a
 * corner-anchored block extends inward and stays on-screen. */
export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export type Tracking = 'tight' | 'normal' | 'wide';
export type Leading = 'tight' | 'normal' | 'loose';

/** One placed text element the agent composed. */
export interface LayoutElement {
  readonly role: ElementRole;
  readonly text: string;
  readonly font: Style['font'];
  readonly weight: Style['weight'];
  readonly case: Style['case'];
  /** Text alignment within the block (multi-line / stacked). */
  readonly align: Style['align'];
  /** Index into {@link SIZE_RAMP} — a modular scale, not an arbitrary px. */
  readonly size: number;
  readonly tracking: Tracking;
  readonly leading: Leading;
  /** Anchor point as a percentage of the frame (0–100). */
  readonly x: number;
  readonly y: number;
  readonly anchor: Anchor;
  /** Break the text into one word per line (the vertical-stack move). */
  readonly stack?: boolean;
  /** Paint this element in the story's accent colour (decision 7.23). */
  readonly accent?: boolean;
  /** Draw a hand-drawn underline in the accent colour beneath this element. */
  readonly underline?: boolean;
}

export interface LayoutSpec {
  readonly elements: readonly LayoutElement[];
}

/** An element resolved for drawing: type as CSS values, a safe-clamped anchor, a
 * neutral h/v alignment, and a max width so text wraps instead of overflowing. */
export interface ResolvedElement {
  /** One entry, or one per word when the element is stacked. */
  readonly lines: string[];
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly textTransform: 'none' | 'uppercase';
  readonly textAlign: 'left' | 'center' | 'right';
  /** Multiplier on the renderer's base caption size. */
  readonly sizeScale: number;
  readonly letterSpacingEm: number;
  readonly lineHeight: number;
  /** Anchor point, clamped into the safe area. */
  readonly xPct: number;
  readonly yPct: number;
  /** How the box sits around (xPct, yPct). DOM translates by these; canvas maps
   * them to textAlign / textBaseline. */
  readonly hAlign: 'left' | 'center' | 'right';
  readonly vAlign: 'top' | 'middle' | 'bottom';
  /** Max width as a % of the frame, so a wide title wraps and stays on-screen. */
  readonly maxWidthPct: number;
  /** Render this element in the story's accent colour (decision 7.23). */
  readonly accent: boolean;
  /** Draw a hand-drawn underline in the accent colour beneath this element. */
  readonly underline: boolean;
}

/** Modular size scale (multipliers on the base). Wide range so a whisper and a
 * masthead both live in the same system. Monotonic. */
export const SIZE_RAMP: readonly number[] = [0.55, 0.72, 1, 1.4, 1.95, 2.7, 3.7];

/** Type stays inside this margin (in % from each edge). */
export const DEFAULT_SAFE_MARGIN_PCT = 6;

const TRACKING_EM: Record<Tracking, number> = { tight: -0.02, normal: 0, wide: 0.08 };
const LINE_HEIGHT: Record<Leading, number> = { tight: 0.92, normal: 1.12, loose: 1.4 };
const ANCHOR_ALIGN: Record<Anchor, { h: ResolvedElement['hAlign']; v: ResolvedElement['vAlign'] }> =
  {
    'top-left': { h: 'left', v: 'top' },
    top: { h: 'center', v: 'top' },
    'top-right': { h: 'right', v: 'top' },
    left: { h: 'left', v: 'middle' },
    center: { h: 'center', v: 'middle' },
    right: { h: 'right', v: 'middle' },
    'bottom-left': { h: 'left', v: 'bottom' },
    bottom: { h: 'center', v: 'bottom' },
    'bottom-right': { h: 'right', v: 'bottom' },
  };

/**
 * Resolve a spec to draw-ready elements: map the type tokens to CSS values, clamp
 * each anchor into the safe area, and derive the neutral h/v alignment. Pure and
 * deterministic — the renderers add colour/scrim and paint.
 */
export function resolveLayout(
  spec: LayoutSpec,
  safeMarginPct = DEFAULT_SAFE_MARGIN_PCT,
): ResolvedElement[] {
  const lo = safeMarginPct;
  const hi = 100 - safeMarginPct;
  const clamp = (v: number): number => Math.min(hi, Math.max(lo, v));
  const maxWidthPct = 100 - 2 * safeMarginPct;

  return spec.elements.map((e) => {
    const align = ANCHOR_ALIGN[e.anchor] ?? ANCHOR_ALIGN.center;
    const stepIndex = Math.max(0, Math.min(SIZE_RAMP.length - 1, Math.round(e.size)));
    return {
      lines: e.stack ? e.text.trim().split(/\s+/).filter(Boolean) : [e.text],
      fontFamily: fontFamily(e.font),
      fontWeight: fontWeightCss(e.weight),
      textTransform: textTransformCss(e.case),
      textAlign: textAlignCss(e.align),
      sizeScale: SIZE_RAMP[stepIndex],
      letterSpacingEm: TRACKING_EM[e.tracking] ?? 0,
      lineHeight: LINE_HEIGHT[e.leading] ?? LINE_HEIGHT.normal,
      xPct: clamp(e.x),
      yPct: clamp(e.y),
      hAlign: align.h,
      vAlign: align.v,
      maxWidthPct,
      accent: e.accent ?? false,
      underline: e.underline ?? false,
    };
  });
}
