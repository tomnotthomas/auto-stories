import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TextFieldModule } from '@angular/cdk/text-field';

import { FramePlacement } from '../../../story/story.service';

/** Caption font size at scale 1; the size slider multiplies it. */
const BASE_FONT_PX = 24;
/**
 * While editing, the caption is lifted into the upper area so it clears the
 * bottom sheet and stays readable (mockup refine-text.html: the selected caption
 * sits at the top, the controls at the bottom). Drag can move it within this
 * band; the smart lower-third default is kept unless the user actually drags.
 */
const EDIT_OPEN_Y = 34;
const DRAG_MIN_Y = 12;
const DRAG_MAX_Y = 62;
const DRAG_MIN_X = 6;
const DRAG_MAX_X = 94;

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
 * The refine caption editor (approach 5.9, mockup refine-text.html). Edits the
 * caption directly in the frame — drag to move, size it, toggle its legibility
 * background, or regenerate it — with a Material bottom sheet for the controls.
 *
 * Purely presentational: the parent (Story / Example) owns the frame state and
 * reacts to the outputs. That keeps it reusable for the first-open example,
 * which teaches the same interaction (5.9) but has nothing to regenerate, so it
 * passes `demo` to hide that action.
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
  readonly caption = input.required<string>();
  readonly placement = input.required<FramePlacement>();
  readonly legibility = input.required<boolean>();
  /** True while a caption regenerate is in flight. */
  readonly busy = input(false);
  /** First-open example: hide Regenerate (no real photos to regenerate from). */
  readonly demo = input(false);

  readonly captionChange = output<string>();
  readonly placementChange = output<Partial<FramePlacement>>();
  readonly legibilityToggle = output<void>();
  readonly regenerate = output<void>();
  readonly done = output<void>();

  /** Local copy of the caption while editing, so typing never fights the parent. */
  protected readonly draft = signal('');
  /** Where the caption sits *while editing* — lifted clear of the sheet. */
  protected readonly posX = signal(50);
  protected readonly posY = signal(EDIT_OPEN_Y);

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

  /** Rendered caption size, in px, from the placement scale. */
  protected readonly fontSize = computed(() => Math.round(BASE_FONT_PX * this.placement().scale));

  ngOnInit(): void {
    this.draft.set(this.caption());
    // Open at the frame's horizontal placement, but lifted so the text clears
    // the sheet; a caption already placed high keeps its spot.
    this.posX.set(this.placement().xPct);
    this.posY.set(Math.min(this.placement().yPct, EDIT_OPEN_Y));
  }

  protected onCaptionInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.draft.set(value);
    this.captionChange.emit(value);
  }

  protected onScale(scale: number): void {
    this.placementChange.emit({ scale });
  }

  /** A finger lands on the caption. One finger drags (record the grab offset so
   * it won't jump); a second finger starts a pinch (record distance + scale). */
  protected startDrag(event: PointerEvent, surface: HTMLElement): void {
    // Capture on the caption box (currentTarget), not whichever child was under
    // the finger, so capture lives on the stable touch-action:none element.
    const box = event.currentTarget as HTMLElement;
    box.setPointerCapture?.(event.pointerId);
    this.captureEl = box;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = surface.getBoundingClientRect();
    if (this.pointers.size === 2) {
      this.pinchStartDist = this.pointerDistance();
      this.pinchStartScale = this.placement().scale;
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
