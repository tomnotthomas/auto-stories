import { Injectable, computed, signal } from '@angular/core';
import type { ErrorCode, Frame, Limits, Tone } from '@auto-stories/api-types';

import { pickReadable, sampleLuminance } from './caption-style';
import { cohesionFilter, frameLuminance } from './caption-cohesion';
import { composeFrame, type Composition, type FrameContent, type PhotoAnalysis } from './look';
import { sampleBands } from './quiet-zone';
import { DEFAULT_ACCENT, sampleAccent } from './accent-color';

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
  /** The photo's own width ÷ height, so anything laying it out can keep its
   * shape. {@link DEFAULT_PHOTO_ASPECT} until the file has been decoded
   * (decision 7.42). */
  readonly aspect: number;
}

/** What a picked photo is assumed to be until it has been read: a phone photo.
 * Kept for any file that cannot be decoded. */
export const DEFAULT_PHOTO_ASPECT = 9 / 16;

/** A story needs a beginning, middle, and payoff — so at least 3 frames (1.11). */
export const MIN_PHOTOS = 3;
/** A real photo dump, not a pre-filtered handful — the AI does the choosing (2.4). */
export const MAX_PHOTOS = 30;
/** The story line is one guided sentence; a soft cap keeps it focused (5.6). */
export const MAX_STORY_LENGTH = 150;
/** Say how many stories are left only from here down.
 *
 * The whole allowance is two a day (7.37), so this is one: a first-time visitor
 * with everything still to spend is told nothing, and the warning arrives on
 * their second story — before the wall, not on it. */
export const WARN_AT_REMAINING = 1;

/** A specific failure to show the user — the contract's ErrorCode, or a
 * transport `network` failure — each mapped to its own screen (4.3, 5.7). */
export interface StoryError {
  readonly code: ErrorCode | 'network';
  readonly message: string;
  /** When the refusal lifts, for the limits that pass on their own (7.36). */
  readonly retryAt?: string;
}

/** A generated frame plus what the device worked out for it: the reading of the
 * photo, the composition that reading produced, and the exposure match. One text
 * per frame (`headline`), and one renderer — the composition (decision 7.25). */
export interface EditableFrame extends Frame {
  /** Computed on-device: true → light (white) type, false → dark. Read by a
   * composition whose Look declares `ink: 'auto'`. */
  readonly light: boolean;
  /** Computed on-device: a CSS/canvas `filter` that matches this photo's
   * exposure to the rest of the story (cohesion); `'none'` until computed. */
  readonly imageFilter: string;
  /** What we measured in the photo (7.24). Neutral until the photo is decoded,
   * then the real reading — kept on the frame so editing the words can recompose
   * without decoding the photo again. */
  readonly analysis: PhotoAnalysis;
  /** This frame under the story's Look (decision 7.24) — type, rules and marks,
   * fully placed — drawn by both the preview and the export. Always present: a
   * frame composes the moment it arrives (from {@link NEUTRAL_ANALYSIS}) and
   * recomposes once the photo has been read, so nothing renders a hole. */
  readonly composition: Composition;
}

/** The reading a frame starts with, before its photo has been decoded: the
 * default accent and no busy band anywhere, so every Look keeps its preferred
 * placement. Replaced by the real reading in {@link StoryService.computeReadable}. */
const NEUTRAL_ANALYSIS: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0, middle: 0, bottom: 0 },
};

/** A photo's own width ÷ height, or null if the file cannot be decoded. The
 * bitmap is closed straight away — only its dimensions are wanted. */
async function naturalAspect(file: File): Promise<number | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const aspect = bitmap.width / bitmap.height;
    bitmap.close();
    return Number.isFinite(aspect) && aspect > 0 ? aspect : null;
  } catch {
    return null;
  }
}

/** Where to sample the photo's luminance for a composition — the middle of the
 * band its type hangs in. */
function inkSampleYPct(composition: Composition): number {
  return composition.anchor === 'bottom' ? 78 : 22;
}

/** The words a Look composes with (decision 7.24/7.25). `headline` is the
 * frame's one piece of text. The place name comes from the frame's location
 * suggestion — the Looks that show one (Magazine's byline, Scrapbook's tag) read
 * it from here. */
function contentOf(frame: Frame): FrameContent {
  return {
    kicker: frame.kicker,
    headline: frame.headline,
    emphasis: frame.emphasis,
    location: frame.suggestions?.find((s) => s.type === 'location')?.query,
  };
}

/** The user's in-app edits to one suggested "spark": where they dragged its dot
 * (a guide only — Instagram placement is manual), whether they dismissed it, and
 * whether they've marked it added. Kept separate from the contract `suggestions`
 * so a regenerate resets it. Absent fields mean "as the AI proposed / not yet". */
export interface SparkState {
  /** Dragged-to centre, in % of the frame; unset → the AI's suggested spot. */
  readonly xPct?: number;
  readonly yPct?: number;
  /** The user swiped/flicked it away — hide it. */
  readonly dismissed?: boolean;
  /** The user checked it off after adding it in Instagram. */
  readonly done?: boolean;
}

/** Stable key for a spark: its frame plus its index within that frame's list. */
export function sparkKey(photoId: string, index: number): string {
  return `${photoId}#${index}`;
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
  /** The story's Look (decision 7.24) — one design language held across every
   * frame. Undefined until a story arrives; the engine then uses its default. */
  private readonly _look = signal<string | undefined>(undefined);
  private readonly _error = signal<StoryError | null>(null);
  private readonly _coachSeen = signal(false);
  private readonly _sparks = signal<ReadonlyMap<string, SparkState>>(new Map());
  private readonly _limits = signal<Limits | null>(null);
  private seq = 0;
  /** Photo shapes are read one batch after another, never all at once. */
  private measuring: Promise<void> = Promise.resolve();

  /** The screen the flow shell should render. */
  readonly phase = this._phase.asReadonly();
  /** The picked photos, in pick order. */
  readonly photos = this._photos.asReadonly();
  /** The user's "What's the story?" line. */
  readonly storyLine = this._storyLine.asReadonly();
  /** The optional tone chip, or null. */
  readonly tone = this._tone.asReadonly();
  /** The finished frames, in narrative order, each already composed under the
   * story's Look (empty until the story lands). */
  readonly frames = this._frames.asReadonly();
  /** True when the model dropped a photo but still produced a story (4.3). */
  readonly partial = this._partial.asReadonly();
  readonly look = this._look.asReadonly();
  /** The current failure, or null. */
  readonly error = this._error.asReadonly();
  /** True once the first-time refine coach mark has been shown (5.9). */
  readonly coachSeen = this._coachSeen.asReadonly();
  /** Per-spark user edits (dragged spot / dismissed / done), keyed by {@link sparkKey}. */
  readonly sparks = this._sparks.asReadonly();
  /** What the caller has left under the fair-use guardrails, or null until it
   * has been read (7.36). */
  readonly limits = this._limits.asReadonly();
  /** True when the picker should say how many are left: only once it is close
   * enough to matter. Telling someone on their first story that they are being
   * counted makes rationing the subject of the product. */
  readonly limitWorthSaying = computed(() => {
    const limits = this._limits();
    return limits !== null && (limits.dayExhausted || limits.remaining <= WARN_AT_REMAINING);
  });

  /** Record what the server says is left. */
  setLimits(limits: Limits | null): void {
    this._limits.set(limits);
  }

  /** How many photos are picked. */
  readonly photoCount = computed(() => this._photos().length);
  /** True once the max is reached, so the picker hides the Add tile. */
  readonly isFull = computed(() => this._photos().length >= MAX_PHOTOS);
  /** Generate is allowed once there are enough photos and a non-empty story line. */
  readonly canGenerate = computed(
    () => this._photos().length >= MIN_PHOTOS && this._storyLine().trim().length > 0,
  );
  /** How many AI add-ons across the story the user hasn't dismissed — drives the
   * hand-off: with any, posting reveals the add-on card before handing off; with
   * none, posting hands off directly. */
  readonly keptSuggestionCount = computed(() => {
    const states = this._sparks();
    let n = 0;
    for (const frame of this._frames()) {
      (frame.suggestions ?? []).forEach((_, i) => {
        if (!states.get(sparkKey(frame.photoId, i))?.dismissed) n++;
      });
    }
    return n;
  });

  /** Leave the first-open example and begin creating a story. */
  startCreating(): void {
    this._phase.set('create');
  }

  /** Boot into a phase from the entry URL, called once on app start. The landing
   * page deep-links its two CTAs to different paths: `/app/create` jumps straight
   * into the picker, while `/app/example` (and the app root) keep the first-open
   * example. Anything else leaves the default example untouched. */
  startFromPath(path: string): void {
    if (/\/create\/?$/.test(path)) this.startCreating();
  }

  /** Add picked files — images only, capped at MAX_PHOTOS total. */
  addPhotos(files: readonly File[]): void {
    const room = MAX_PHOTOS - this._photos().length;
    if (room <= 0) return;
    const added: PickedPhoto[] = files
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, room)
      .map((file) => ({
        id: `photo-${++this.seq}`,
        file,
        previewUrl: URL.createObjectURL(file),
        aspect: DEFAULT_PHOTO_ASPECT,
      }));
    if (!added.length) return;
    this._photos.update((photos) => [...photos, ...added]);
    this.measureShapes(added);
  }

  /**
   * Read each new photo's real shape and record it. Done here, on the picker,
   * because that is minutes before anything lays a photo out — so the generating
   * screen has every shape in hand before its first paint and never has to
   * resize a print it has already dealt.
   *
   * Decoded one at a time, and queued behind any earlier batch, so peak memory
   * stays flat however many were picked (4.5). A file that cannot be decoded
   * keeps {@link DEFAULT_PHOTO_ASPECT}.
   */
  private measureShapes(added: readonly PickedPhoto[]): void {
    this.measuring = this.measuring.then(async () => {
      for (const photo of added) {
        const aspect = await naturalAspect(photo.file);
        if (aspect === null) continue;
        this._photos.update((photos) =>
          photos.map((p) => (p.id === photo.id ? { ...p, aspect } : p)),
        );
      }
    });
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

  /** Store the finished story and show the payoff. Each contract frame composes
   * immediately under the story's Look from a neutral reading of the photo, so
   * there is never a moment with nothing to render; computeReadable() then
   * recomposes it from the real pixels. */
  completeStory(frames: readonly Frame[], partial: boolean, look?: string): void {
    this._look.set(look);
    this._frames.set(reindex(frames.map((frame) => this.toEditable(frame))));
    this._partial.set(partial);
    this._sparks.set(new Map()); // a new story → fresh suggestions, fresh spark edits
    this._phase.set('story');
    void this.computeReadable();
  }

  /**
   * Read each frame's photo and rebuild what depends on the pixels (7.10 — the
   * device does this, not the model): the story accent + band map, the
   * composition those produce, the legible ink polarity, and the exposure match
   * that pulls the set together. Runs after the story is shown, so the payoff
   * isn't blocked on decoding; frames update in place when each is ready.
   */
  private async computeReadable(): Promise<void> {
    const files = new Map(this._photos().map((photo) => [photo.id, photo.file]));
    const read = new Map<
      string,
      { light: boolean; filter: string; analysis: PhotoAnalysis; composition: Composition }
    >();
    for (const frame of this._frames()) {
      const file = files.get(frame.photoId);
      if (!file) continue;
      try {
        const bitmap = await createImageBitmap(file);
        const analysis: PhotoAnalysis = {
          accent: sampleAccent(bitmap),
          bands: sampleBands(bitmap),
        };
        const composition = composeFrame(this._look(), contentOf(frame), analysis);
        read.set(frame.photoId, {
          light: pickReadable(sampleLuminance(bitmap, inkSampleYPct(composition))).light,
          filter: cohesionFilter(frameLuminance(bitmap)),
          analysis,
          composition,
        });
        bitmap.close();
      } catch {
        // Keep the neutral reading (and the composition it produced) on a decode
        // failure — the frame still renders, just without the photo's own accent.
      }
    }
    if (read.size === 0) return;
    this._frames.update((frames) =>
      frames.map((frame) => {
        const r = read.get(frame.photoId);
        return r ? { ...frame, ...r } : frame;
      }),
    );
  }

  /** Refine: add a hand-picked photo as a new frame at the end, keeping the
   * existing frames untouched (used by "Add photo", 2.5). The words are set by
   * the caller. A photoId already in the story is ignored. */
  appendFrame(frame: Frame): void {
    this._frames.update((frames) => {
      if (frames.some((f) => f.photoId === frame.photoId)) return frames;
      const nextOrder = frames.reduce((max, f) => Math.max(max, f.order), 0) + 1;
      return [...frames, this.toEditable({ ...frame, order: nextOrder })];
    });
  }

  /** Refine: rewrite a frame's words (manual edit or per-frame regenerate), and
   * recompose it so the change lands in the one thing that renders. The stored
   * {@link EditableFrame.analysis} means this costs no photo decode. */
  setHeadline(photoId: string, headline: string): void {
    this._frames.update((frames) =>
      frames.map((frame) => {
        if (frame.photoId !== photoId) return frame;
        const next = { ...frame, headline };
        return {
          ...next,
          composition: composeFrame(this._look(), contentOf(next), next.analysis),
        };
      }),
    );
  }

  /** A contract frame plus its on-device state, composed under the story's Look
   * from the neutral reading (the real one arrives with computeReadable). */
  private toEditable(frame: Frame): EditableFrame {
    return {
      ...frame,
      light: true,
      imageFilter: 'none',
      analysis: NEUTRAL_ANALYSIS,
      composition: composeFrame(this._look(), contentOf(frame), NEUTRAL_ANALYSIS),
    };
  }

  /** Merge a patch into one spark's state, immutably (creating the entry if new). */
  private patchSpark(photoId: string, index: number, patch: Partial<SparkState>): void {
    const key = sparkKey(photoId, index);
    this._sparks.update((sparks) => {
      const next = new Map(sparks);
      next.set(key, { ...next.get(key), ...patch });
      return next;
    });
  }

  /** Sparks: move a suggestion's dot to where the user dragged it (guide only). */
  moveSpark(photoId: string, index: number, xPct: number, yPct: number): void {
    this.patchSpark(photoId, index, { xPct, yPct });
  }

  /** Sparks: hide a suggestion the user swiped away. */
  dismissSpark(photoId: string, index: number): void {
    this.patchSpark(photoId, index, { dismissed: true });
  }

  /** Sparks: toggle whether the user has marked a suggestion added in Instagram. */
  toggleSparkDone(photoId: string, index: number): void {
    const key = sparkKey(photoId, index);
    this.patchSpark(photoId, index, { done: !this._sparks().get(key)?.done });
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
    this._sparks.set(new Map());
    this._phase.set('example');
  }
}
