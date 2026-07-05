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
const DRAG_MIN_X = 10;
const DRAG_MAX_X = 90;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  private dragging = false;

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

  protected startDrag(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragging = true;
  }

  /** Drag within the editing band; the surface is the full-frame overlay. Only
   * the local position updates on move (so the caption tracks the finger with no
   * lag); the parent's placement is committed once on release. */
  protected onDrag(event: PointerEvent, surface: HTMLElement): void {
    if (!this.dragging) return;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.posX.set(clamp(((event.clientX - rect.left) / rect.width) * 100, DRAG_MIN_X, DRAG_MAX_X));
    this.posY.set(clamp(((event.clientY - rect.top) / rect.height) * 100, DRAG_MIN_Y, DRAG_MAX_Y));
  }

  protected endDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.placementChange.emit({ xPct: this.posX(), yPct: this.posY() });
  }
}
