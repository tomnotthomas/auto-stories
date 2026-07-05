import { Injectable, computed, signal } from '@angular/core';
import type { ErrorCode, Frame, Tone } from '@auto-stories/api-types';

/**
 * The screen the flow is currently on. Phase 1 is one linear, in-memory flow
 * (approach 3.17), so navigation is a signal here rather than the router:
 *   example    — first-open interactive example (the wow)
 *   create     — pick photos + "What's the story?" + tone
 *   generating — the model is building the story
 *   story      — the finished, refinable story (the payoff)
 *   error      — a specific failure (at-capacity / timeout / …)
 */
export type StoryPhase = 'example' | 'create' | 'generating' | 'story' | 'error';

/** A photo the user has picked, before it's downscaled for the model. */
export interface PickedPhoto {
  /** Client-assigned id, echoed back on the matching frame (contract Photo.id). */
  readonly id: string;
  /** The original full-res file — downscaled to a proxy only at generate time. */
  readonly file: File;
  /** Object URL for showing the photo in the picker grid. */
  readonly previewUrl: string;
}

/** A story needs a beginning, middle, and payoff — so at least 3 frames (1.11). */
export const MIN_PHOTOS = 3;
/** A real photo dump, not a pre-filtered handful — the AI does the choosing (2.4). */
export const MAX_PHOTOS = 30;
/** The story line is one guided sentence; a soft cap keeps it focused (5.6). */
export const MAX_STORY_LENGTH = 150;

/** A specific failure to show the user — the contract's ErrorCode, or a
 * transport `network` failure — each mapped to its own screen (4.3, 5.7). */
export interface StoryError {
  readonly code: ErrorCode | 'network';
  readonly message: string;
}

/** Where the caption sits on a frame, as the user placed it in refine (1.5, 5.9):
 * box centre as a percentage of the photo, plus a text-size multiplier. Percentages
 * keep the placement correct across the phone-frame and full-bleed layouts (5.10). */
export interface FramePlacement {
  readonly xPct: number;
  readonly yPct: number;
  readonly scale: number;
}

/** The AI's smart default: lower third, unscaled (1.5). */
export const DEFAULT_PLACEMENT: FramePlacement = { xPct: 50, yPct: 78, scale: 1 };

/** A generated frame plus the state the user refines in place: the caption text,
 * where it sits, and whether it keeps its legibility background (5.3, 5.9). */
export interface EditableFrame extends Frame {
  readonly placement: FramePlacement;
  readonly legibility: boolean;
}

/** Sort by narrative order, then renumber 1..n so `order` stays contiguous
 * after a reorder or drop. */
function reindex(frames: readonly EditableFrame[]): EditableFrame[] {
  return [...frames]
    .sort((a, b) => a.order - b.order)
    .map((frame, i) => ({ ...frame, order: i + 1 }));
}

/**
 * Holds the in-progress story in signals and drives the flow between screens.
 * A single root singleton (approach 3.8) — no NgRx, no router. It is the model
 * for the create step too: the picker and story field read/write these signals
 * directly rather than a separate form.
 */
@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly _phase = signal<StoryPhase>('example');
  private readonly _photos = signal<readonly PickedPhoto[]>([]);
  private readonly _storyLine = signal('');
  private readonly _tone = signal<Tone | null>(null);
  private readonly _frames = signal<readonly EditableFrame[]>([]);
  private readonly _partial = signal(false);
  private readonly _error = signal<StoryError | null>(null);
  private readonly _coachSeen = signal(false);
  private seq = 0;

  /** The screen the flow shell should render. */
  readonly phase = this._phase.asReadonly();
  /** The picked photos, in pick order. */
  readonly photos = this._photos.asReadonly();
  /** The user's "What's the story?" line. */
  readonly storyLine = this._storyLine.asReadonly();
  /** The optional tone chip, or null. */
  readonly tone = this._tone.asReadonly();
  /** The finished frames, in narrative order, each with its editable refine state
   * (empty until the story lands). */
  readonly frames = this._frames.asReadonly();
  /** True when the model dropped a photo but still produced a story (4.3). */
  readonly partial = this._partial.asReadonly();
  /** The current failure, or null. */
  readonly error = this._error.asReadonly();
  /** True once the first-time refine coach mark has been shown (5.9). */
  readonly coachSeen = this._coachSeen.asReadonly();

  /** How many photos are picked. */
  readonly photoCount = computed(() => this._photos().length);
  /** True once the max is reached, so the picker hides the Add tile. */
  readonly isFull = computed(() => this._photos().length >= MAX_PHOTOS);
  /** Generate is allowed once there are enough photos and a non-empty story line. */
  readonly canGenerate = computed(
    () => this._photos().length >= MIN_PHOTOS && this._storyLine().trim().length > 0,
  );

  /** Leave the first-open example and begin creating a story. */
  startCreating(): void {
    this._phase.set('create');
  }

  /** Add picked files — images only, capped at MAX_PHOTOS total. */
  addPhotos(files: readonly File[]): void {
    const room = MAX_PHOTOS - this._photos().length;
    if (room <= 0) return;
    const added = files
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, room)
      .map((file) => ({ id: `photo-${++this.seq}`, file, previewUrl: URL.createObjectURL(file) }));
    if (added.length) this._photos.update((photos) => [...photos, ...added]);
  }

  /** Remove a picked photo and release its preview URL. */
  removePhoto(id: string): void {
    const photo = this._photos().find((p) => p.id === id);
    if (!photo) return;
    URL.revokeObjectURL(photo.previewUrl);
    this._photos.update((photos) => photos.filter((p) => p.id !== id));
  }

  /** Set the story line, trimmed to the soft max length. */
  setStoryLine(value: string): void {
    this._storyLine.set(value.slice(0, MAX_STORY_LENGTH));
  }

  /** Select a tone chip, or pass null to clear it (tone is optional). */
  setTone(tone: Tone | null): void {
    this._tone.set(tone);
  }

  /** Submit the create step and move to the generating screen. */
  startGenerating(): void {
    this._error.set(null);
    this._phase.set('generating');
  }

  /** Store the finished story and show the payoff. Each contract frame gains its
   * editable refine state (default placement, legibility on). */
  completeStory(frames: readonly Frame[], partial: boolean): void {
    this._frames.set(
      reindex(frames.map((frame) => ({ ...frame, placement: DEFAULT_PLACEMENT, legibility: true }))),
    );
    this._partial.set(partial);
    this._phase.set('story');
  }

  /** Refine: add a hand-picked photo as a new frame at the end, keeping the
   * existing frames and their placements untouched (used by "Add photo", 2.5).
   * The caption is set by the caller; order/placement/legibility are defaulted.
   * A photoId already in the story is ignored. */
  appendFrame(frame: Frame): void {
    this._frames.update((frames) => {
      if (frames.some((f) => f.photoId === frame.photoId)) return frames;
      const nextOrder = frames.reduce((max, f) => Math.max(max, f.order), 0) + 1;
      return [
        ...frames,
        { ...frame, order: nextOrder, placement: DEFAULT_PLACEMENT, legibility: true },
      ];
    });
  }

  /** Refine: rewrite a frame's caption (manual edit or per-caption regenerate). */
  setCaption(photoId: string, caption: string): void {
    this._frames.update((frames) =>
      frames.map((frame) => (frame.photoId === photoId ? { ...frame, caption } : frame)),
    );
  }

  /** Refine: move/resize a caption. Partial so a drag (x/y) and a resize (scale)
   * each merge into the frame's placement (1.5). */
  setPlacement(photoId: string, placement: Partial<FramePlacement>): void {
    this._frames.update((frames) =>
      frames.map((frame) =>
        frame.photoId === photoId
          ? { ...frame, placement: { ...frame.placement, ...placement } }
          : frame,
      ),
    );
  }

  /** Refine: toggle a frame's legibility background (5.9). */
  toggleLegibility(photoId: string): void {
    this._frames.update((frames) =>
      frames.map((frame) =>
        frame.photoId === photoId ? { ...frame, legibility: !frame.legibility } : frame,
      ),
    );
  }

  /** Refine: drag-to-reorder the narrative (5.1). Moves the frame at `from` to
   * `to` and renumbers `order`. */
  reorderFrames(from: number, to: number): void {
    this._frames.update((frames) => {
      const next = [...frames];
      const [moved] = next.splice(from, 1);
      if (!moved) return frames;
      next.splice(to, 0, moved);
      return reindex(next.map((frame, i) => ({ ...frame, order: i + 1 })));
    });
  }

  /** Refine: drop a photo from the story, keeping ≥ MIN_PHOTOS so it stays a
   * story (1.11). No-op when already at the minimum. Also drops it from the pool
   * so a later "Regenerate story" doesn't bring it back. */
  dropPhoto(photoId: string): void {
    if (this._frames().length <= MIN_PHOTOS) return;
    this._frames.update((frames) => reindex(frames.filter((frame) => frame.photoId !== photoId)));
    this.removePhoto(photoId);
  }

  /** Mark the first-time refine coach mark as seen so it shows only once (5.9). */
  markCoachSeen(): void {
    this._coachSeen.set(true);
  }

  /** Record a specific failure and show the error screen (4.3). */
  failStory(error: StoryError): void {
    this._error.set(error);
    this._phase.set('error');
  }

  /** Clear everything and return to the first-open example (start over). */
  reset(): void {
    for (const photo of this._photos()) URL.revokeObjectURL(photo.previewUrl);
    this._photos.set([]);
    this._storyLine.set('');
    this._tone.set(null);
    this._frames.set([]);
    this._partial.set(false);
    this._error.set(null);
    this._phase.set('example');
  }
}
