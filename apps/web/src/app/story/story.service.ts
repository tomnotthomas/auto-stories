import { Injectable, computed, signal } from '@angular/core';
import type { ErrorCode, Frame, TextBlock, Tone } from '@auto-stories/api-types';

import {
  DEFAULT_STYLE,
  pickReadable,
  sampleLuminance,
  zoneToPlacement,
  type Readable,
} from './caption-style';
import { cohesionFilter, frameLuminance } from './caption-cohesion';
import { composeFrame, type Composition, type FrameContent } from './look';
import { sampleBands } from './quiet-zone';
import { sampleAccent } from './accent-color';

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

/** The smart default: centred in the always-visible band — high enough that the
 * refine bar / edit sheet never cover it — unscaled (1.5). */
export const DEFAULT_PLACEMENT: FramePlacement = { xPct: 50, yPct: 46, scale: 1 };

/** One extra placed text block besides the caption, with its editable refine
 * state (its own spot, background, and computed colour). The style fields mirror
 * the contract {@link TextBlock}; `position` is replaced by a free `placement`. */
export interface EditableTextBlock {
  readonly text: string;
  readonly font: TextBlock['font'];
  readonly weight: TextBlock['weight'];
  readonly case: TextBlock['case'];
  readonly align: TextBlock['align'];
  readonly size: TextBlock['size'];
  readonly placement: FramePlacement;
  readonly legibility: boolean;
  readonly light: boolean;
}

/** A generated frame plus the state the user refines in place: the caption text,
 * where it sits, and whether it keeps its legibility background (5.3, 5.9), plus
 * any extra placed text blocks the AI added and the user can edit. */
export interface EditableFrame extends Frame {
  readonly placement: FramePlacement;
  readonly legibility: boolean;
  /** Computed on-device: true → light (white) caption text, false → dark. */
  readonly light: boolean;
  /** Computed on-device: a CSS/canvas `filter` that matches this photo's
   * exposure to the rest of the story (cohesion); `'none'` until computed. */
  readonly imageFilter: string;
  /** Extra placed text blocks (0–2) besides the caption, each editable. */
  readonly extraTexts: readonly EditableTextBlock[];
  /** This frame under the story's Look (decision 7.24) — type, rules and marks,
   * fully placed. Composed on-device from the frame's words plus what we measured
   * in the photo, and drawn by both the preview and the export. Undefined until
   * the photo has been read. */
  readonly composition?: Composition;
  /** The accent colour for this frame (7.23), sampled from the photo. */
  readonly accent?: string;
}

/** The words a Look composes with (decision 7.24). `headline` is guaranteed by
 * the server, but fall back to the caption anyway so a frame always composes.
 * The place name comes from the frame's location suggestion — the Looks that
 * show one (Magazine's byline, Scrapbook's tag) read it from here. */
function contentOf(frame: Frame): FrameContent {
  return {
    kicker: frame.kicker,
    headline: frame.headline?.trim() || frame.caption,
    emphasis: frame.emphasis,
    location: frame.suggestions?.find((s) => s.type === 'location')?.query,
  };
}

/** Build the editable extra-text state for a contract frame's `texts` — each
 * block starts at its AI zone with a safe (white + scrim) look, refined by
 * computeReadable(). */
function toEditableTexts(frame: Frame): EditableTextBlock[] {
  return (frame.texts ?? []).map((b) => ({
    text: b.text,
    font: b.font,
    weight: b.weight,
    case: b.case,
    align: b.align,
    size: b.size,
    placement: zoneToPlacement(b.position),
    legibility: true,
    light: true,
  }));
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
  readonly look = this._look.asReadonly();
  /** The current failure, or null. */
  readonly error = this._error.asReadonly();
  /** True once the first-time refine coach mark has been shown (5.9). */
  readonly coachSeen = this._coachSeen.asReadonly();
  /** Per-spark user edits (dragged spot / dismissed / done), keyed by {@link sparkKey}. */
  readonly sparks = this._sparks.asReadonly();

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
  completeStory(frames: readonly Frame[], partial: boolean, look?: string): void {
    this._look.set(look);
    this._frames.set(
      reindex(
        frames.map((frame) => ({
          ...frame,
          // Start the caption where the AI placed it (its style zone); the user
          // can still drag. Legibility + colour start safe (white + scrim) and
          // are refined by computeReadable() from the real pixels.
          placement: zoneToPlacement((frame.style ?? DEFAULT_STYLE).position),
          legibility: true,
          light: true,
          imageFilter: 'none',
          extraTexts: toEditableTexts(frame),
        })),
      ),
    );
    this._partial.set(partial);
    this._sparks.set(new Map()); // a new story → fresh suggestions, fresh spark edits
    this._phase.set('story');
    void this.computeReadable();
  }

  /**
   * For each frame, sample the photo under the caption and pick a legible text
   * colour + whether a scrim is needed (decisions 7.10 — the device does this,
   * not the model). Runs after the story is shown, so the payoff isn't blocked
   * on decoding; frames update in place when each is ready.
   */
  private async computeReadable(): Promise<void> {
    const files = new Map(this._photos().map((photo) => [photo.id, photo.file]));
    const readable = new Map<
      string,
      {
        light: boolean;
        scrim: boolean;
        filter: string;
        extras: Readable[];
        composition?: Composition;
        accent?: string;
      }
    >();
    for (const frame of this._frames()) {
      const file = files.get(frame.photoId);
      if (!file) continue;
      try {
        const bitmap = await createImageBitmap(file);
        // One decode does several jobs: legibility under each text block, the
        // exposure match that pulls the whole set together (cohesion), and the
        // two readings the Looks engine needs — the story accent and how busy
        // each band of the photo is (7.24).
        const accent = sampleAccent(bitmap);
        const composition = composeFrame(this._look(), contentOf(frame), {
          accent,
          bands: sampleBands(bitmap),
        });
        readable.set(frame.photoId, {
          ...pickReadable(sampleLuminance(bitmap, frame.placement)),
          filter: cohesionFilter(frameLuminance(bitmap)),
          extras: frame.extraTexts.map((b) => pickReadable(sampleLuminance(bitmap, b.placement))),
          composition,
          accent,
        });
        bitmap.close();
      } catch {
        // Keep the safe defaults (white text + scrim, no filter) on decode fail.
      }
    }
    if (readable.size === 0) return;
    this._frames.update((frames) =>
      frames.map((frame) => {
        const r = readable.get(frame.photoId);
        if (!r) return frame;
        return {
          ...frame,
          light: r.light,
          legibility: r.scrim,
          imageFilter: r.filter,
          extraTexts: frame.extraTexts.map((b, i) =>
            r.extras[i] ? { ...b, light: r.extras[i].light, legibility: r.extras[i].scrim } : b,
          ),
          composition: r.composition ?? frame.composition,
          accent: r.accent ?? frame.accent,
        };
      }),
    );
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
        {
          ...frame,
          order: nextOrder,
          placement: zoneToPlacement((frame.style ?? DEFAULT_STYLE).position),
          legibility: true,
          light: true,
          imageFilter: 'none',
          extraTexts: toEditableTexts(frame),
        },
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

  /** Map one frame's extra blocks, applying `fn` to the block at `index`. */
  private mapExtra(
    photoId: string,
    index: number,
    fn: (block: EditableTextBlock) => EditableTextBlock,
  ): void {
    this._frames.update((frames) =>
      frames.map((frame) =>
        frame.photoId === photoId
          ? { ...frame, extraTexts: frame.extraTexts.map((b, i) => (i === index ? fn(b) : b)) }
          : frame,
      ),
    );
  }

  /** Refine: rewrite an extra text block's words. */
  setExtraText(photoId: string, index: number, text: string): void {
    this.mapExtra(photoId, index, (b) => ({ ...b, text }));
  }

  /** Refine: move/resize an extra text block (partial, like setPlacement). */
  setExtraPlacement(photoId: string, index: number, placement: Partial<FramePlacement>): void {
    this.mapExtra(photoId, index, (b) => ({ ...b, placement: { ...b.placement, ...placement } }));
  }

  /** Refine: toggle an extra text block's background. */
  toggleExtraLegibility(photoId: string, index: number): void {
    this.mapExtra(photoId, index, (b) => ({ ...b, legibility: !b.legibility }));
  }

  /** Refine: add a new, empty extra text block (capped at 2). Returns its index,
   * or -1 if the frame is at the cap or missing — the caller opens the editor. */
  addExtraText(photoId: string): number {
    let newIndex = -1;
    this._frames.update((frames) =>
      frames.map((frame) => {
        if (frame.photoId !== photoId || frame.extraTexts.length >= 2) return frame;
        newIndex = frame.extraTexts.length;
        const block: EditableTextBlock = {
          text: '',
          font: DEFAULT_STYLE.font,
          weight: DEFAULT_STYLE.weight,
          case: DEFAULT_STYLE.case,
          align: DEFAULT_STYLE.align,
          size: DEFAULT_STYLE.size,
          placement: DEFAULT_PLACEMENT,
          legibility: true,
          light: true,
        };
        return { ...frame, extraTexts: [...frame.extraTexts, block] };
      }),
    );
    return newIndex;
  }

  /** Refine: remove an extra text block (deleted, or left empty on close). */
  removeExtraText(photoId: string, index: number): void {
    this._frames.update((frames) =>
      frames.map((frame) =>
        frame.photoId === photoId
          ? { ...frame, extraTexts: frame.extraTexts.filter((_, i) => i !== index) }
          : frame,
      ),
    );
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
