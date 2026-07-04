import { Component, ElementRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TextFieldModule } from '@angular/cdk/text-field';

import { FramePlacement } from '../../../story/story.service';

/** Caption font size at scale 1; the size slider multiplies it. */
const BASE_FONT_PX = 24;

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
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    TextFieldModule,
  ],
  templateUrl: './caption-editor.html',
})
export class CaptionEditor implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
  private dragging = false;

  /** Rendered caption size, in px, from the placement scale. */
  protected readonly fontSize = computed(() => Math.round(BASE_FONT_PX * this.placement().scale));

  ngOnInit(): void {
    this.draft.set(this.caption());
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

  protected onDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.placementChange.emit({
      xPct: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      yPct: clamp(((event.clientY - rect.top) / rect.height) * 100, 12, 88),
    });
  }

  protected endDrag(event: PointerEvent): void {
    this.dragging = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  }
}
