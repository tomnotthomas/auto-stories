import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { Frame } from '@auto-stories/api-types';

import { ImageService } from '../../story/image.service';
import { StoryService } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import type { GenerateOutcome } from '../../story/story.gateway';
import {
  LaneEngine,
  filterFor,
  geometryFor,
  openFor,
  transform,
  transformFor,
  type LaneGeometry,
  type Print,
} from './lane-engine';
import { beatsFor, paceFor, typeFor, type PrintType, type TypeLine } from './frame-type';
import { SAMPLE_WINDOW, shouldLighten } from './frame-budget';

/** How far the reveal has got on one print. */
interface Reveal {
  scrim: boolean;
  rule: boolean;
  kicker: boolean;
  /** How many words of the headline have landed. */
  words: number;
}

/** A print plus the words the model set on it (the lane itself carries no text). */
interface PrintView {
  readonly print: Print;
  /** The image actually shown — a display-sized copy when one was ready in time,
   * otherwise the original. Fixed when the print is dealt so it never swaps
   * under the user. */
  readonly src: string;
  type: PrintType | null;
  reveal: Reveal;
}

/** The last values written to a print's element. */
interface Painted {
  transform: string;
  opacity: string;
  filter: string;
  z: string;
}

/** One of the story's progress bars, which a kept print flattens into. */
interface Segment {
  readonly index: number;
  readonly left: number;
  readonly width: number;
  /** The transform that puts this bar back over the print it came from. */
  readonly from: string;
}

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_MOVE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** A tap during a hold means "I've read it" — the rest of that beat runs 4× . */
const TAP_BOOST = 4;
/**
 * How long the screen will spend showing the choices still waiting once the
 * story has landed. The model does its reading first and then writes the whole
 * answer in well under a second, so in practice most choices are still waiting
 * at that point — they are shown one at a time inside this budget rather than
 * dropped on the pile together, because seeing each photo be chosen is the
 * point of the screen (decision 7.30).
 */
const TAIL_BUDGET_MS = 6000;
/** Roughly what one full catch costs, used to work out how much to speed up. */
const ONE_CATCH_MS = 5000;
/** How long the first prints wait for their display-sized copies. */
const SOURCE_WAIT_MS = 700;
/** The lane eases to a stop before the catch — it must never cut. */
const STOP_MS = 300;
/** The print's travel to the focal point, and the beat it is left to settle. */
const COME_FORWARD_MS = 760;
const SETTLE_MS = 660;
/** The kept print's drop onto the pile after its words have been read. */
const TO_PILE_MS = 520;

/**
 * The model is building the story, and the screen shows the work rather than
 * hiding it (decision 7.29). The user's own photos become prints on a light
 * table: they drift up through the middle, pile up dim at the top as they are
 * looked past, and stack at the bottom as they are chosen. Each choice the
 * model makes is caught, held still, and its words set on it beat by beat as it
 * arrives (7.30); then the kept pile flattens into the story's own progress
 * bars and the first frame opens full-bleed.
 *
 * The screen is a thing to watch, not to operate: the only touch it takes is a
 * tap to move a beat along (decision 7.32).
 */
@Component({
  selector: 'app-generating',
  templateUrl: './generating.html',
  host: {
    class: 'block h-full w-full',
    '(pointerdown)': 'onSurfaceDown()',
    '(window:resize)': 'onResize()',
  },
})
export class Generating implements OnDestroy {
  private readonly story = inject(StoryService);
  private readonly generation = inject(GenerationService);
  private readonly images = inject(ImageService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly view = inject(DOCUMENT).defaultView;

  /** The OS asked for less movement: the drift, the depth blur and the travel
   * go; the reveal and the gesture stay. Everything-at-once is jarring, not
   * accessible — the fades are what is kept. */
  protected readonly reduced =
    this.view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected readonly geometry = signal<LaneGeometry>(geometryFor(390, 844));
  private engine = new LaneEngine(this.geometry(), { reduced: this.reduced });

  /** The render list. A new array identity is what tells Angular to re-read the
   * bindings, so every beat of the reveal ends with {@link bump}. */
  protected readonly prints = signal<readonly PrintView[]>([]);
  protected readonly segments = signal<readonly Segment[]>([]);
  /** The tallies hide while the model's print is being read. */
  protected readonly chrome = signal(true);
  protected readonly quiet = signal(false);
  private readonly seenCount = signal(0);
  private readonly keptCount = signal(0);

  protected readonly seenLabel = computed(() =>
    this.seenCount() ? `${this.seenCount()} looked at` : '',
  );
  protected readonly keptLabel = computed(() =>
    this.keptCount() ? `${this.keptCount()} kept` : '',
  );
  protected readonly status = computed(() =>
    this.quiet() ? 'Still looking through your photos…' : 'Building your story…',
  );

  private readonly printEls = viewChildren<ElementRef<HTMLElement>>('printEl');
  private readonly segmentEls = viewChildren<ElementRef<HTMLElement>>('segmentEl');
  private readonly elements = new Map<string, HTMLElement>();
  /** What was last written to each print's element, so an unchanged value is
   * never written again. The whole point of stepping the blur is that it holds
   * still for several frames — which only pays if those frames skip the write. */
  private readonly painted = new Map<string, Painted>();

  private raf = 0;
  private lastFrame = 0;
  private t0 = 0;
  private alive = true;
  private holding = false;
  private ending = false;
  private boost = 1;
  /** Choices the model has written that have not been shown yet. */
  private readonly pending: Frame[] = [];
  /** Every photo already queued, so a repeated report deals nothing twice. */
  private readonly announced = new Set<string>();
  /** Every photo whose words have actually been set on its print. */
  private readonly revealed = new Set<string>();
  /** True while the queue is being worked through. */
  private pumping = false;
  /** The finished story has arrived, so no new full catch is started. */
  private storyLanded = false;
  /** How long the story is — unknown until it lands. */
  private total: number | null = null;
  /** Display-sized copies of the picked photos, by photo id. */
  private readonly sources = new Map<string, string>();
  /** Recent frame durations, watched so the lane can shed what it cannot afford. */
  private readonly frameTimes: number[] = [];
  private ready: Promise<void>;
  private markReady: () => void = () => undefined;

  constructor() {
    this.ready = new Promise((resolve) => {
      this.markReady = resolve;
    });
    // The elements the loop writes to, kept in step with what is rendered.
    effect(() => {
      this.elements.clear();
      for (const ref of this.printEls()) {
        const key = ref.nativeElement.dataset['print'];
        if (key) this.elements.set(key, ref.nativeElement);
      }
    });
    afterNextRender(() => void this.start(), { injector: this.injector });
    void this.run();
  }

  ngOnDestroy(): void {
    this.alive = false;
    for (const url of this.sources.values()) URL.revokeObjectURL(url);
    if (this.raf) this.view?.cancelAnimationFrame(this.raf);
  }

  /* ── the table ─────────────────────────────────────────────────────────── */

  /** Measure the surface, deal the first prints, and start the loop. */
  private async start(): Promise<void> {
    const geo = this.measure();
    this.geometry.set(geo);
    this.engine = new LaneEngine(geo, { reduced: this.reduced });
    this.engine.setPool(
      this.story
        .photos()
        .map((photo) => ({ id: photo.id, src: photo.previewUrl, aspect: photo.aspect })),
    );
    // Give the downscaled copies a moment to arrive before the first prints are
    // dealt; whatever is not ready by then is dealt at full size, which looks
    // identical and only costs memory.
    await this.prepareSources();
    if (!this.alive) return;
    this.engine.seed();
    this.sync();
    this.t0 = this.now();
    this.lastFrame = 0;
    this.raf = this.view?.requestAnimationFrame(this.tick) ?? 0;
    this.markReady();
  }

  /** The surface changed size — on Android that is the URL bar collapsing, which
   * moves every landmark the lane is judged against. Re-measure and carry the
   * table over rather than leaving it laid out for a screen that is gone. */
  protected onResize(): void {
    const geo = this.measure();
    if (geo.w === this.geometry().w && geo.h === this.geometry().h) return;
    this.geometry.set(geo);
    this.engine.resize(geo);
    // Prints that have landed are normally left to their own animation, but a
    // resize moves the ground under them: their size follows the new surface
    // while the transform their finished animation still holds would not. So
    // every print is taken back from whatever is animating it and rewritten.
    for (const print of this.engine.prints) {
      const element = this.elements.get(print.key);
      for (const running of element?.getAnimations?.() ?? []) running.cancel();
      this.forget(print);
      this.place(print);
    }
    // Each print's box has been re-derived from its own photo, and the box is a
    // binding rather than a loop write — so the render list has to be re-read.
    this.bump();
  }

  /**
   * Decode a display-sized copy of each photo, one at a time so peak memory
   * stays flat (4.5) and so a cheap phone is never decoding eight originals at
   * once — which is itself a source of the stutter this is here to remove.
   */
  private async prepareSources(): Promise<void> {
    const photos = this.story.photos();
    const done = (async () => {
      for (const photo of photos) {
        if (!this.alive) return;
        try {
          const url = await this.images.toDisplayUrl(photo.file);
          if (url) this.sources.set(photo.id, url);
        } catch {
          // No downscaled copy for this one; it is dealt at full size, which
          // looks identical and only costs memory. Never a reason not to start.
          return;
        }
      }
    })();
    await Promise.race([done, this.wait(SOURCE_WAIT_MS)]);
  }

  private measure(): LaneGeometry {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0
      ? geometryFor(rect.width, rect.height)
      : this.geometry();
  }

  private readonly tick = (now: number): void => {
    if (!this.alive) return;
    this.raf = this.view?.requestAnimationFrame(this.tick) ?? 0;
    const dt = this.lastFrame ? now - this.lastFrame : 16;
    this.lastFrame = now;
    this.watchTheBudget(dt);
    const { tucked } = this.engine.step(dt, now - this.t0);
    if (tucked.length) {
      for (const print of tucked) this.toss(print);
      this.seenCount.set(this.engine.seenCount);
    }
    if (this.engine.prints.length !== this.prints().length) this.sync();
    this.updateQuiet();
    this.render();
  };

  /** The pool is spent and we are still waiting: go quiet rather than repeat
   * photos the user has already been shown. */
  private updateQuiet(): void {
    this.quiet.set(this.engine.runningDry && !this.holding && !this.ending);
  }

  /**
   * Watch what the frames are actually costing on this device and shed the depth
   * blur if they are too slow (decision 7.34). There is no property that says
   * "this phone is cheap", so the screen finds out by running.
   */
  private watchTheBudget(dt: number): void {
    if (this.engine.isLightened || this.reduced) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > SAMPLE_WINDOW) this.frameTimes.shift();
    if (shouldLighten(this.frameTimes)) this.engine.lighten();
  }

  /** Write the lane's continuous state straight to the elements. A print that
   * has landed on a pile is left alone — its own animation owns it. */
  private render(): void {
    // Only what is moving: a print that has landed on a pile is not in the lane,
    // and everything in the lane is by definition still going somewhere.
    for (const print of this.engine.lane) this.place(print);
  }

  /** Write one print's current state to its element. */
  private place(print: Print): void {
    const element = this.elements.get(print.key);
    if (!element) return;
    const transform = transformFor(print, this.engine.swayFor(print));
    // Two decimals: a 1% step in opacity is below what an eye can see, and it
    // turns a value that changed every frame into one that rarely does.
    const opacity = print.opacity.toFixed(2);
    const filter = filterFor(print);
    const z = String(print.z);

    const last = this.painted.get(print.key);
    if (!last) {
      element.style.transform = transform;
      element.style.opacity = opacity;
      element.style.filter = filter;
      element.style.zIndex = z;
      this.painted.set(print.key, { transform, opacity, filter, z });
      return;
    }
    // Writing a property is never free, even when the value is identical: it is
    // a CSSOM call and a style-invalidation check per print per frame.
    if (last.transform !== transform) {
      element.style.transform = transform;
      last.transform = transform;
    }
    if (last.opacity !== opacity) {
      element.style.opacity = opacity;
      last.opacity = opacity;
    }
    if (last.filter !== filter) {
      element.style.filter = filter;
      last.filter = filter;
    }
    if (last.z !== z) {
      element.style.zIndex = z;
      last.z = z;
    }
  }

  /** Rebuild the render list from the lane, keeping the words already set. */
  private sync(): void {
    const existing = new Map(this.prints().map((view) => [view.print.key, view]));
    this.prints.set(
      this.engine.prints.map(
        (print) =>
          existing.get(print.key) ?? {
            print,
            src: this.sources.get(print.photoId) ?? print.src,
            type: null,
            reveal: { scrim: false, rule: false, kicker: false, words: 0 },
          },
      ),
    );
  }

  /** Tell Angular to re-read the bindings after a beat changed something. */
  private bump(): void {
    this.prints.update((views) => [...views]);
  }

  private viewOf(print: Print): PrintView | undefined {
    return this.prints().find((view) => view.print === print);
  }

  /** A press anywhere during a hold means "I've read it", so the rest of that
   * beat runs faster. */
  protected onSurfaceDown(): void {
    if (this.holding) this.boost = TAP_BOOST;
  }

  /* ── the piles ─────────────────────────────────────────────────────────── */

  /** A print tossed onto the seen pile — the rotation overshoots, then settles. */
  private toss(print: Print): void {
    this.forget(print);
    const element = this.elements.get(print.key);
    // Reduced motion: it goes out where it stands. Sliding it up to the pile
    // would be the movement this mode exists to avoid, and the pile it would
    // land on is not drawn in this mode anyway — the tally carries the count.
    if (this.reduced) {
      if (element) {
        this.play(
          element,
          [{ opacity: element.style.opacity || '1' }, { opacity: 0 }],
          300,
          EASE_OUT,
        );
      }
      return;
    }
    const to = transformFor(print);
    const filter = filterFor(print);
    if (element) {
      this.play(
        element,
        [
          {
            transform: element.style.transform,
            opacity: element.style.opacity || '1',
            filter: element.style.filter || 'none',
          },
          {
            transform: transform(print, print.x, print.y, print.rot * 1.5, print.scale * 1.04),
            offset: 0.62,
          },
          { transform: to, opacity: '0.66', filter },
        ],
        520,
        EASE_OUT,
      );
      element.style.transform = to;
      element.style.opacity = '0.66';
      element.style.filter = filter;
      element.style.zIndex = String(print.z);
    }
    this.nudge(this.engine.seen.slice(-7, -1), 2.5);
  }

  /** The kept pile refanned, with the prints already there nudged by the landing. */
  private settleKept(): void {
    this.nudge(this.engine.kept.slice(0, -1), 3);
    this.restack();
    this.keptCount.set(this.engine.kept.length);
  }

  private restack(): void {
    for (const print of this.engine.kept) {
      this.forget(print);
      const element = this.elements.get(print.key);
      if (!element) continue;
      const to = transformFor(print);
      const filter = filterFor(print);
      this.play(
        element,
        [
          { transform: element.style.transform, filter: element.style.filter || 'none' },
          { transform: to, filter },
        ],
        this.reduced ? 240 : 600,
        EASE_MOVE,
      );
      element.style.transform = to;
      element.style.filter = filter;
      element.style.opacity = '1';
      element.style.zIndex = String(print.z);
    }
  }

  /** Landing on a pile moves the prints already there — things react to weight. */
  private nudge(prints: readonly Print[], px: number): void {
    if (this.reduced) return;
    prints.forEach((print, i) => {
      const element = this.elements.get(print.key);
      if (!element || !print.settled) return;
      const at = element.style.transform;
      this.play(
        element,
        [
          { transform: at },
          { transform: `${at} translateY(${px}px)`, offset: 0.38 },
          { transform: at },
        ],
        420,
        EASE_OUT,
        i * 14,
      );
    });
  }

  /* ── the model's turn ──────────────────────────────────────────────────── */

  private async run(): Promise<void> {
    const outcome = await this.generation.requestStory(undefined, (frames) =>
      this.onFrames(frames),
    );
    if (!this.alive) return;
    if (!outcome.ok) {
      this.generation.applyOutcome(outcome);
      return;
    }
    await this.ready;
    if (!this.alive) return;
    const frames = [...outcome.response.frames].sort((a, b) => a.order - b.order);
    this.total = frames.length;
    await this.reveal(frames, outcome.response.look);
    if (!this.alive) return;
    await this.land(frames);
    if (!this.alive) return;
    this.finish(outcome);
  }

  /**
   * The model has finished writing another choice (decision 7.30). The report is
   * cumulative, so anything already queued is skipped, and the queue is worked
   * through one catch at a time — the wait is what the reveal is spread across.
   */
  private onFrames(frames: readonly Frame[]): void {
    for (const frame of frames) {
      if (this.announced.has(frame.photoId)) continue;
      this.announced.add(frame.photoId);
      this.pending.push(frame);
    }
    void this.pump();
  }

  /** Work the queue, one full catch at a time. Only ever one pump running. */
  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      await this.ready;
      while (this.alive && !this.ending && !this.storyLanded) {
        const frame = this.pending.shift();
        if (!frame) break;
        await this.catchFrame(frame, this.total, undefined);
      }
    } finally {
      this.pumping = false;
    }
  }

  /** Bring the model's choice onto the table and read it out in full. */
  private async catchFrame(
    frame: Frame,
    total: number | null,
    look: string | undefined,
    pace = 1,
  ): Promise<void> {
    this.quiet.set(false);
    const view = this.bring(frame, total, look);
    if (!view) return;
    // A quick catch pulls the print in rather than waiting for it to drift up:
    // there are others behind it.
    if (!this.reduced && pace === 1) await this.driftToFocal(view.print);
    if (!this.alive) return;
    await this.catchIt(view, pace);
    this.revealed.add(frame.photoId);
  }

  /** Land the finished story on the payoff. */
  private finish(outcome: GenerateOutcome): void {
    this.generation.applyOutcome(outcome);
  }

  /**
   * The story has landed, so the whole of it is known. Every choice that has not
   * been shown yet still gets shown — one at a time, each with the same beats —
   * because watching the model pick each photo is the point. What gives way is
   * the time, not the choreography: the run is paced to fit {@link
   * TAIL_BUDGET_MS}, so six choices are read out quickly rather than dropped on
   * the pile together.
   *
   * The first one caught is always read at full speed: if the model wrote
   * everything at the last moment, the opener still gets its proper reveal.
   */
  private async reveal(frames: readonly Frame[], look: string): Promise<void> {
    this.storyLanded = true;
    while (this.alive && this.pumping) await this.wait(60);
    if (!this.alive) return;

    const waiting = frames.filter((frame) => !this.revealed.has(frame.photoId));
    if (waiting.length === 0) return;

    const [first, ...rest] = this.revealed.size === 0 ? waiting : [];
    if (first) {
      await this.catchFrame(first, frames.length, look);
      if (!this.alive) return;
    }
    const tail = first ? rest : waiting;
    const pace = paceFor(tail.length, TAIL_BUDGET_MS, ONE_CATCH_MS);
    for (const frame of tail) {
      if (!this.alive) return;
      await this.catchFrame(frame, frames.length, look, pace);
    }
  }

  /** Put the model's chosen photo on the table with its words set. A photo that
   * has already left the lane — the user pulled it down, or it drifted past — is
   * lifted back out of its pile and written on rather than dealt a second time. */
  private bring(frame: Frame, total: number | null, look: string | undefined): PrintView | null {
    const photo = this.story.photos().find((candidate) => candidate.id === frame.photoId);
    if (!photo) return null;
    const existing = this.engine.prints.find((print) => print.photoId === frame.photoId);
    const print =
      existing ??
      this.engine.dealNamed({ id: photo.id, src: photo.previewUrl, aspect: photo.aspect });
    if (existing && existing.pile !== 'lane') {
      this.engine.lift(existing);
      this.seenCount.set(this.engine.seenCount);
      this.keptCount.set(this.engine.kept.length);
    } else if (!existing) {
      print.y = this.geometry().h * 0.92;
    }
    this.sync();
    const view = this.viewOf(print);
    if (view) view.type = typeFor(frame, total, look);
    this.bump();
    return view ?? null;
  }

  /** Let the print drift up to the focal point on its own, and simply stop there. */
  private async driftToFocal(print: Print): Promise<void> {
    const focal = this.geometry().focal + 4;
    // Bounded: if the print has not arrived by now (a background tab froze the
    // loop, say), it is caught where it is rather than holding the story back.
    let guard = 120;
    while (this.alive && guard-- > 0 && print.y > focal) {
      await this.wait(40);
    }
  }

  /**
   * The catch: the lane eases to a stop (it never cuts), the rest of the table
   * blurs and recedes, the print comes forward — and only once it is completely
   * still do the words begin, one beat at a time.
   */
  private async catchIt(view: PrintView, pace = 1): Promise<void> {
    const print = view.print;
    const type = view.type;
    const beats = beatsFor(this.reduced, pace);
    const quicker = (ms: number): number => Math.max(1, Math.round(ms / pace));
    this.holding = true;
    print.held = true;
    print.settled = false;

    this.engine.vTarget = 0;
    await this.wait(this.reduced ? 1 : quicker(STOP_MS));
    if (!this.alive) return;

    this.engine.focusTarget = 1;
    this.chrome.set(false);
    this.comeForward(print, pace);
    await this.wait(this.reduced ? 200 : quicker(SETTLE_MS));
    if (!this.alive) return;

    // Complete stillness before any type: overlapping the settle with the
    // writing is what reads as rushed.
    await this.wait(beats.stillness);
    if (!this.alive) return;

    if (type && !type.silent) {
      view.reveal.scrim = true;
      this.bump();
      await this.wait(beats.scrim);
      view.reveal.rule = true;
      this.bump();
      await this.wait(beats.rule);
      view.reveal.kicker = true;
      this.bump();
      await this.wait(beats.kicker);
      for (const line of type.lines) {
        for (let i = 0; i < line.words.length; i++) {
          if (!this.alive) return;
          view.reveal.words = line.startIndex + i + 1;
          this.bump();
          await this.wait(beats.word);
        }
        await this.wait(beats.lineGap);
      }
    }
    // Another choice is already waiting, so this one is left up for half as
    // long — the beats stay whole, the reading time gives way.
    await this.wait(this.pending.length > 0 ? beats.dwell / 2 : beats.dwell);
    if (!this.alive) return;

    print.held = false;
    this.engine.toKept(print);
    this.settleKept();
    this.bump();
    await this.wait(this.reduced ? 200 : quicker(TO_PILE_MS));

    this.engine.focusTarget = 0;
    this.engine.vTarget = 1;
    this.chrome.set(true);
    this.holding = false;
    this.boost = 1;
  }

  /** The print comes forward to the focal point with a small overshoot. */
  private comeForward(print: Print, pace = 1): void {
    this.forget(print);
    const element = this.elements.get(print.key);
    const from = element?.style.transform ?? '';
    this.engine.hold(print);
    const to = transformFor(print);
    if (!element) return;
    this.play(
      element,
      this.reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { transform: from, offset: 0 },
            {
              transform: transform(print, print.x, print.y, print.rot, print.scale * 1.022),
              offset: 0.74,
            },
            { transform: to, offset: 1 },
          ],
      this.reduced ? 260 : Math.max(1, Math.round(COME_FORWARD_MS / pace)),
      EASE_MOVE,
    );
    element.style.transform = to;
    element.style.filter = 'none';
    element.style.opacity = '1';
    element.style.zIndex = String(print.z);
  }

  /* ── the ending ────────────────────────────────────────────────────────── */

  /** The kept prints flatten into the story's own progress bars while the first
   * frame opens full-bleed. The loading screen becomes the story screen. */
  private async land(frames: readonly Frame[]): Promise<void> {
    this.ending = true;
    for (const print of this.engine.prints) this.forget(print);
    this.chrome.set(false);
    this.quiet.set(false);
    this.engine.arrangeKept(frames.map((frame) => frame.photoId));
    this.restack();

    for (const print of this.engine.lane) {
      const element = this.elements.get(print.key);
      if (element) {
        this.play(
          element,
          [{ opacity: element.style.opacity || '1' }, { opacity: 0 }],
          300,
          EASE_OUT,
        );
      }
    }
    this.engine.seen.forEach((print, i) => {
      const element = this.elements.get(print.key);
      if (element) {
        this.play(element, [{ opacity: '0.66' }, { opacity: 0 }], 280, EASE_OUT, (i % 6) * 20);
      }
    });

    const geo = this.geometry();
    const kept = [...this.engine.kept];
    const width = (geo.w - 28 - (kept.length - 1) * 4) / Math.max(1, kept.length);
    this.segments.set(
      kept.map((print, i) => {
        const left = 14 + i * (width + 4);
        const slot = print.slot ?? { x: geo.w / 2, y: geo.h, scale: print.scale };
        const dx = slot.x - (left + width / 2);
        const dy = slot.y - 23.5;
        // The bar starts as the print it came from, so each one is measured
        // against that print's own box rather than a shared card.
        return {
          index: i,
          left,
          width,
          from:
            `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ` +
            `scale(${((print.w * slot.scale) / width).toFixed(3)}, ${((print.h * slot.scale) / 3).toFixed(3)})`,
        };
      }),
    );

    await this.afterRender();
    if (!this.alive) return;
    this.segmentEls().forEach((ref, i) => {
      const segment = this.segments()[i];
      if (!segment) return;
      this.play(
        ref.nativeElement,
        [
          { transform: segment.from, opacity: 0.5 },
          { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
        ],
        this.reduced ? 260 : 640,
        EASE_MOVE,
        i * 40,
      );
      ref.nativeElement.style.opacity = '1';
    });

    kept.forEach((print, i) => {
      const element = this.elements.get(print.key);
      if (!element) return;
      if (i === 0) {
        element.style.zIndex = '30';
        this.play(
          element,
          [
            { transform: element.style.transform, borderRadius: '22px' },
            {
              transform: transform(print, geo.w / 2, geo.h / 2, 0, openFor(print, geo)),
              borderRadius: '0px',
            },
          ],
          this.reduced ? 260 : 700,
          EASE_MOVE,
        );
        // The story screen sets this frame's words under the story's Look, so
        // the reveal's own setting leaves with the open rather than swapping.
        const view = this.viewOf(print);
        if (view) view.reveal = { scrim: false, rule: false, kicker: false, words: 0 };
      } else {
        this.play(element, [{ opacity: 1 }, { opacity: 0 }], 260, EASE_OUT, i * 40);
      }
    });
    this.bump();

    await this.wait(this.reduced ? 300 : 700);
  }

  /* ── template helpers ──────────────────────────────────────────────────── */

  /** The classes a print carries beyond its static ones: a compositor layer only
   * while it is actually moving, and — under reduced motion — the crossfade that
   * takes the place of the drift. */
  protected printClass(view: PrintView): string {
    const classes = view.print.settled ? [] : ['will-change-[transform,opacity,filter]'];
    if (this.reduced) classes.push('[transition:opacity_300ms_cubic-bezier(0.23,1,0.32,1)]');
    return classes.join(' ');
  }

  /** Reduced motion draws no rule; it fades one in that is already full width. */
  protected ruleTransform(view: PrintView): string {
    if (this.reduced) return 'scaleX(1)';
    return view.reveal.rule ? 'scaleX(1)' : 'scaleX(0)';
  }

  protected isLineSet(view: PrintView, line: TypeLine): boolean {
    return view.reveal.words > line.startIndex;
  }

  protected isWordIn(view: PrintView, line: TypeLine, index: number): boolean {
    return view.reveal.words > line.startIndex + index;
  }

  /* ── plumbing ──────────────────────────────────────────────────────────── */

  /** An animation or a pile move writes the element's style itself, so whatever
   * was last painted is no longer what is on the element. */
  private forget(print: Print): void {
    this.painted.delete(print.key);
  }

  private play(
    element: HTMLElement,
    keyframes: Keyframe[],
    duration: number,
    easing: string,
    delay = 0,
  ): void {
    if (typeof element.animate !== 'function') return;
    // A finished `fill: forwards` animation keeps owning the properties it
    // animated, so it would outrank the styles written after it. Each new move
    // takes the element back first.
    for (const running of element.getAnimations?.() ?? []) running.cancel();
    element.animate(keyframes, {
      duration: Math.max(1, duration / this.boost),
      delay: delay / this.boost,
      easing,
      fill: 'forwards',
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(1, ms / this.boost)));
  }

  private afterRender(): Promise<void> {
    return new Promise((resolve) => afterNextRender(() => resolve(), { injector: this.injector }));
  }

  private now(): number {
    return this.view?.performance.now() ?? Date.now();
  }
}
