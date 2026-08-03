import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TextFieldModule } from '@angular/cdk/text-field';

/**
 * Where the edited text sits and how big it is, as the host stores it: box
 * centre as a percentage of the frame, plus a size multiplier. Percentages keep
 * it correct across the phone-frame and full-bleed layouts (5.10).
 *
 * Only a host that can *store* a placement passes one. The story's frames no
 * longer have one — the Look owns placement (7.25) — so there the editor is text
 * only; the first-open example still teaches drag + resize on its own copy.
 */
export interface FramePlacement {
  readonly xPct: number;
  readonly yPct: number;
  readonly scale: number;
}

/** The smart default: centred in the always-visible band — high enough that the
 * edit sheet never covers it — unscaled (1.5). */
export const DEFAULT_PLACEMENT: FramePlacement = { xPct: 50, yPct: 46, scale: 1 };

/** Text font size at scale 1; the size slider multiplies it. */
const BASE_FONT_PX = 24;
/**
 * The caption lives in one fixed, always-visible band: high enough to clear the
 * top edit bar, low enough to clear the bottom sheet. Opening the editor keeps
 * the caption exactly where it is shown (no lift), so it never jumps on open or
 * snaps back on Done; a drag is clamped to the same band so it can't be pushed
 * behind either bar.
 */
const DRAG_MIN_Y = 14;
const DRAG_MAX_Y = 58;
// The caption box is `w-[78%]` centred on x, so its half-width is 39% of the
// frame; the centre must stay within [39, 61] to keep both edges on-frame. The
// band is kept a hair tighter so the box never touches the very edge.
const DRAG_MIN_X = 40;
const DRAG_MAX_X = 60;

/** Caption scale range — matches the size slider's min/max in the template. */
const SCALE_MIN = 0.6;
const SCALE_MAX = 1.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Where the caption's centre goes for a one-finger drag. `grabDX`/`grabDY` are
 * the offset (in % of the frame) between the caption centre and the finger at
 * grab time; adding them back keeps the caption under the finger where it was
 * grabbed, instead of snapping its centre to the finger (which read as a jump).
 * Clamped to the editing band so the caption stays on-frame and clears the sheet.
 */
export function draggedPosition(
  pointerXPct: number,
  pointerYPct: number,
  grabDX: number,
  grabDY: number,
): { x: number; y: number } {
  return {
    x: clamp(pointerXPct + grabDX, DRAG_MIN_X, DRAG_MAX_X),
    y: clamp(pointerYPct + grabDY, DRAG_MIN_Y, DRAG_MAX_Y),
  };
}

/**
 * Scale for a two-finger pinch: the start scale times how much the fingers have
 * spread (current distance ÷ start distance), clamped to the slider range. A
 * degenerate start distance holds the start scale (no divide-by-zero).
 */
export function pinchedScale(startScale: number, startDist: number, dist: number): number {
  if (startDist <= 0) return startScale;
  const scaled = clamp(startScale * (dist / startDist), SCALE_MIN, SCALE_MAX);
  return Math.round(scaled * 100) / 100;
}

/**
 * The refine text editor (approach 5.9, mockup refine-text.html). Edits a
 * frame's words directly on the frame, with a Material bottom sheet for the
 * controls.
 *
 * Purely presentational: the parent (Story / Example) owns the frame state and
 * reacts to the outputs — and each control appears only when the parent has
 * somewhere to put its result. The example passes `demo` (nothing to
 * regenerate); the story passes no `placement` or `legibility`, because there
 * the Look owns placement and lays its own scrim (7.25).
 */
@Component({
  selector: 'app-caption-editor',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatProgressSpinnerModule,
    TextFieldModule,
  ],
  templateUrl: './caption-editor.html',
})
export class CaptionEditor implements OnInit {
  /** The frame's words — the one piece of text on the photo (7.25). */
  readonly headline = input.required<string>();
  /** Where the text sits, when the host stores a placement; null → text only
   * (no drag, no pinch, no size slider). */
  readonly placement = input<FramePlacement | null>(null);
  /** The host's legibility background, when it has one; null → no toggle. */
  readonly legibility = input<boolean | null>(null);
  /** True while a regenerate is in flight. */
  readonly busy = input(false);
  /** First-open example: hide Regenerate (no real photos to regenerate from). */
  readonly demo = input(false);
  /** Offer Remove for a block the host can delete. */
  readonly removable = input(false);

  readonly headlineChange = output<string>();
  readonly placementChange = output<Partial<FramePlacement>>();
  readonly legibilityToggle = output<void>();
  readonly regenerate = output<void>();
  readonly remove = output<void>();
  readonly done = output<void>();

  /** Local copy of the text while editing, so typing never fights the parent. */
  protected readonly draft = signal('');
  /** Where the text sits while editing — its stored placement, unchanged. */
  protected readonly posX = signal(DEFAULT_PLACEMENT.xPct);
  protected readonly posY = signal(DEFAULT_PLACEMENT.yPct);
  /** True when the host can store a placement, so the move/resize controls have
   * somewhere to land. */
  protected readonly movable = computed(() => this.placement() !== null);

  /** Live finger positions (clientX/clientY) keyed by pointerId: 1 → drag, 2 → pinch. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** Offset (in % of the frame) from the finger to the caption centre at grab time. */
  private grabDX = 0;
  private grabDY = 0;
  /** Finger distance and caption scale captured when the second finger lands. */
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  /** The element holding pointer capture (the caption box), so we release on it. */
  private captureEl: HTMLElement | null = null;

  /** Rendered text size, in px, from the placement scale. */
  protected readonly fontSize = computed(() => Math.round(BASE_FONT_PX * this.scale()));

  /** The stored size multiplier, or 1 when the host keeps no placement. */
  protected readonly scale = computed(() => this.placement()?.scale ?? 1);

  ngOnInit(): void {
    this.draft.set(this.headline());
    // Open exactly where the text is displayed — no lift — so it doesn't jump on
    // open or snap back on Done. Placement already lives in the visible band.
    const placement = this.placement();
    if (placement) {
      this.posX.set(placement.xPct);
      this.posY.set(placement.yPct);
    }
  }

  protected onHeadlineInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.draft.set(value);
    this.headlineChange.emit(value);
  }

  protected onScale(scale: number): void {
    this.placementChange.emit({ scale });
  }

  /** A finger lands on the text. One finger drags (record the grab offset so it
   * won't jump); a second finger starts a pinch (record distance + scale). */
  protected startDrag(event: PointerEvent, surface: HTMLElement): void {
    if (!this.movable()) return;
    // Capture on the text box (currentTarget), not whichever child was under the
    // finger, so capture lives on the stable touch-action:none element.
    const box = event.currentTarget as HTMLElement;
    box.setPointerCapture?.(event.pointerId);
    this.captureEl = box;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = surface.getBoundingClientRect();
    if (this.pointers.size === 2) {
      this.pinchStartDist = this.pointerDistance();
      this.pinchStartScale = this.scale();
    } else {
      this.seatGrab(event.clientX, event.clientY, rect);
    }
  }

  /** Move the fingers. Two down → pinch-scale (emitted live, like the slider);
   * one down → drag, keeping the grab offset so the caption tracks the finger
   * with no jump and no lag (placement is committed once on release). */
  protected onDrag(event: PointerEvent, surface: HTMLElement): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    if (this.pointers.size >= 2) {
      this.placementChange.emit({
        scale: pinchedScale(this.pinchStartScale, this.pinchStartDist, this.pointerDistance()),
      });
      return;
    }

    const pointerXPct = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerYPct = ((event.clientY - rect.top) / rect.height) * 100;
    const next = draggedPosition(pointerXPct, pointerYPct, this.grabDX, this.grabDY);
    this.posX.set(next.x);
    this.posY.set(next.y);
  }

  /** A finger lifts (or the gesture is cancelled). When the last finger leaves,
   * commit the caption's placement. Dropping from a pinch to one finger re-seats
   * that finger's grab offset so a following drag doesn't jump. */
  protected endDrag(event: PointerEvent, surface: HTMLElement): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    this.captureEl?.releasePointerCapture?.(event.pointerId);

    if (this.pointers.size === 0) {
      this.captureEl = null;
      this.placementChange.emit({ xPct: this.posX(), yPct: this.posY() });
    } else if (this.pointers.size === 1) {
      const [remaining] = [...this.pointers.values()];
      this.seatGrab(remaining.x, remaining.y, surface.getBoundingClientRect());
    }
  }

  /** Record the offset from the finger to the caption centre, in % of the frame. */
  private seatGrab(clientX: number, clientY: number, rect: DOMRect): void {
    if (!rect.width || !rect.height) return;
    this.grabDX = this.posX() - ((clientX - rect.left) / rect.width) * 100;
    this.grabDY = this.posY() - ((clientY - rect.top) / rect.height) * 100;
  }

  /** Distance between the two active fingers, in px. */
  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
