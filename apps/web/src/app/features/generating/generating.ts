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

import { StoryService } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import type { GenerateOutcome } from '../../story/story.gateway';
import {
  LaneEngine,
  filterFor,
  geometryFor,
  transform,
  transformFor,
  type LaneGeometry,
  type Print,
} from './lane-engine';
import { beatsFor, typeFor, type PrintType, type TypeLine } from './frame-type';

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
  type: PrintType | null;
  reveal: Reveal;
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

/** The invitation shows only if the user hasn't already found the gesture. */
const HINT_AFTER_MS = 2400;
/** A tap during a hold means "I've read it" — the rest of that beat runs 4× . */
const TAP_BOOST = 4;
/** Between two of the model's later choices landing on the kept pile. */
const DEAL_GAP_MS = 220;
/** The lane eases to a stop before the catch — it must never cut. */
const STOP_MS = 300;
/** The print's travel to the focal point, and the beat it is left to settle. */
const COME_FORWARD_MS = 760;
const SETTLE_MS = 660;
const SETTLE_AGREED_MS = 520;
/** The kept print's drop onto the pile after its words have been read. */
const TO_PILE_MS = 520;

/**
 * The model is building the story, and the screen shows the work rather than
 * hiding it (decision 7.29). The user's own photos become prints on a light
 * table: they drift up through the middle, pile up dim at the top as they are
 * looked past, and stack at the bottom as they are kept. The user can reach in
 * and pull a print down themselves — the same job the model is doing, at the
 * same time. When the story lands, the model's first choice is caught, held
 * still, and its words are set on it beat by beat; then the kept pile flattens
 * into the story's own progress bars and the first frame opens full-bleed.
 *
 * Slice 1: one round trip (no streaming), so only the first choice is read out
 * in full — the rest arrive on the pile with their words already set rather
 * than telling the whole story before the user is let into it.
 */
@Component({
  selector: 'app-generating',
  templateUrl: './generating.html',
  host: {
    class: 'block h-full w-full',
    '(pointerdown)': 'onSurfaceDown()',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp()',
    '(pointercancel)': 'onPointerUp()',
  },
})
export class Generating implements OnDestroy {
  private readonly story = inject(StoryService);
  private readonly generation = inject(GenerationService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly view = inject(DOCUMENT).defaultView;

  /** The OS asked for less movement: the drift, the depth blur and the travel
   * go; the reveal and the gesture stay. Everything-at-once is jarring, not
   * accessible — the fades are what is kept. */
  private readonly reduced =
    this.view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected readonly geometry = signal<LaneGeometry>(geometryFor(390, 844));
  private engine = new LaneEngine(this.geometry(), { reduced: this.reduced });

  /** The render list. A new array identity is what tells Angular to re-read the
   * bindings, so every beat of the reveal ends with {@link bump}. */
  protected readonly prints = signal<readonly PrintView[]>([]);
  protected readonly segments = signal<readonly Segment[]>([]);
  protected readonly armed = signal<'keep' | 'pass' | null>(null);
  /** The tallies hide while the model's print is being read. */
  protected readonly chrome = signal(true);
  protected readonly hint = signal(false);
  protected readonly quiet = signal(false);
  private readonly seenCount = signal(0);
  private readonly keptCount = signal(0);
  private readonly myCount = signal(0);

  protected readonly seenLabel = computed(() =>
    this.seenCount() ? `${this.seenCount()} looked at` : '',
  );
  protected readonly keptLabel = computed(() => {
    const kept = this.keptCount();
    const mine = this.myCount();
    if (!kept && !mine) return '';
    return mine ? `${kept} kept · ${mine} yours` : `${kept} kept`;
  });
  protected readonly status = computed(() =>
    this.quiet() ? 'Still looking through your photos…' : 'Building your story…',
  );

  private readonly printEls = viewChildren<ElementRef<HTMLElement>>('printEl');
  private readonly segmentEls = viewChildren<ElementRef<HTMLElement>>('segmentEl');
  private readonly elements = new Map<string, HTMLElement>();

  private raf = 0;
  private lastFrame = 0;
  private t0 = 0;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private alive = true;
  private touched = false;
  private holding = false;
  private ending = false;
  private boost = 1;
  private capture: { element: HTMLElement; pointerId: number } | null = null;
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
  /** Set when a press landed on a print, so the surface handler behind it knows
   * the press was spent on the gesture and is not the "I've read it" tap. */
  private caught = false;
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
    afterNextRender(() => this.start(), { injector: this.injector });
    void this.run();
  }

  ngOnDestroy(): void {
    this.alive = false;
    if (this.raf) this.view?.cancelAnimationFrame(this.raf);
    if (this.hintTimer) clearTimeout(this.hintTimer);
  }

  /* ── the table ─────────────────────────────────────────────────────────── */

  /** Measure the surface, deal the first prints, and start the loop. */
  private start(): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const geo =
      rect.width > 0 && rect.height > 0 ? geometryFor(rect.width, rect.height) : this.geometry();
    this.geometry.set(geo);
    this.engine = new LaneEngine(geo, { reduced: this.reduced });
    this.engine.setPool(
      this.story.photos().map((photo) => ({ id: photo.id, src: photo.previewUrl })),
    );
    this.engine.seed();
    this.sync();
    this.t0 = this.now();
    this.lastFrame = 0;
    this.raf = this.view?.requestAnimationFrame(this.tick) ?? 0;
    // The invitation, once, and only if they haven't already found the gesture.
    this.hintTimer = setTimeout(() => {
      if (this.alive && !this.touched && !this.holding && !this.ending) this.hint.set(true);
    }, HINT_AFTER_MS);
    this.markReady();
  }

  private readonly tick = (now: number): void => {
    if (!this.alive) return;
    this.raf = this.view?.requestAnimationFrame(this.tick) ?? 0;
    const dt = this.lastFrame ? now - this.lastFrame : 16;
    this.lastFrame = now;
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

  /** Write the lane's continuous state straight to the elements. A print that
   * has landed on a pile is left alone — its own animation owns it. */
  private render(): void {
    const geo = this.geometry();
    for (const print of this.engine.prints) {
      if (print.settled) continue;
      const element = this.elements.get(print.key);
      if (!element) continue;
      element.style.transform = transformFor(print, geo, this.engine.swayFor(print));
      element.style.opacity = String(print.opacity);
      element.style.filter = filterFor(print);
      element.style.zIndex = String(print.z);
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

  /* ── the gesture ───────────────────────────────────────────────────────── */

  /** A finger lands on a print: it is lifted out of the lane and follows. */
  protected onPrintDown(event: PointerEvent, print: Print): void {
    if (!this.engine.grab(print, event.clientX, event.clientY, this.now())) return;
    this.caught = true;
    this.touched = true;
    this.hint.set(false);
    this.capturePointer(event);
    this.bump();
  }

  /** A press that caught no print. During a hold that means "I've read it", so
   * the rest of the beat runs faster. */
  protected onSurfaceDown(): void {
    const caught = this.caught;
    this.caught = false;
    if (!caught && this.holding) this.boost = TAP_BOOST;
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.engine.dragging) return;
    this.engine.drag(event.clientX, event.clientY, this.now());
    this.armed.set(this.engine.armed);
  }

  protected onPointerUp(): void {
    const print = this.engine.grabbedPrint;
    const result = this.engine.release();
    this.releasePointer();
    this.armed.set(null);
    if (!print || !result) return;
    if (result === 'kept') {
      this.story.pickPhoto(print.photoId);
      this.view?.navigator.vibrate?.(8);
      this.settleKept();
    } else if (result === 'passed') {
      this.toss(print);
      this.seenCount.set(this.engine.seenCount);
    } else {
      this.springBack(print);
    }
    this.updateQuiet();
    this.bump();
  }

  private capturePointer(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target.closest('[data-print]') : null;
    if (!(target instanceof HTMLElement) || typeof event.pointerId !== 'number') return;
    try {
      target.setPointerCapture(event.pointerId);
      this.capture = { element: target, pointerId: event.pointerId };
    } catch {
      // A synthetic pointer has no capture to take; the host still sees the move.
    }
  }

  private releasePointer(): void {
    const capture = this.capture;
    this.capture = null;
    if (!capture) return;
    try {
      capture.element.releasePointerCapture(capture.pointerId);
    } catch {
      // Already released with the pointer itself.
    }
  }

  /* ── the piles ─────────────────────────────────────────────────────────── */

  /** A print tossed onto the seen pile — the rotation overshoots, then settles. */
  private toss(print: Print): void {
    const element = this.elements.get(print.key);
    const geo = this.geometry();
    const to = transformFor(print, geo);
    const filter = filterFor(print);
    if (element) {
      this.play(
        element,
        this.reduced
          ? [{ opacity: element.style.opacity || '1' }, { opacity: '0.66' }]
          : [
              {
                transform: element.style.transform,
                opacity: element.style.opacity || '1',
                filter: element.style.filter || 'none',
              },
              {
                transform: transform(geo, print.x, print.y, print.rot * 1.5, print.scale * 1.04),
                offset: 0.62,
              },
              { transform: to, opacity: '0.66', filter },
            ],
        this.reduced ? 240 : print.flung ? 400 : 520,
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
    this.keptCount.set(this.engine.kept.length - this.engine.myCount);
    this.myCount.set(this.engine.myCount);
  }

  private restack(): void {
    const geo = this.geometry();
    for (const print of this.engine.kept) {
      const element = this.elements.get(print.key);
      if (!element) continue;
      const to = transformFor(print, geo);
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

  /** Released in between: it goes back to the lane, and releasing is always fast. */
  private springBack(print: Print): void {
    const element = this.elements.get(print.key);
    if (!element || this.reduced) return;
    const geo = this.geometry();
    this.play(
      element,
      [
        {
          transform: transform(
            geo,
            print.x,
            print.y,
            print.rot + this.engine.releaseKick,
            this.engine.grabbedScale,
          ),
        },
        { transform: transformFor(print, geo) },
      ],
      220,
      EASE_OUT,
    );
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
    this.finish(outcome, frames);
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
  ): Promise<void> {
    this.quiet.set(false);
    const agreed = this.story.userPicks().includes(frame.photoId);
    const view = this.bring(frame, total, agreed, look);
    if (!view) return;
    if (!agreed && !this.reduced) await this.driftToFocal(view.print);
    if (!this.alive) return;
    await this.catchIt(view);
    this.revealed.add(frame.photoId);
  }

  /** Land the story, then send the prints the user pulled down that the model
   * did not use back through the "add a photo" path, so their picks join it. */
  private finish(outcome: GenerateOutcome, frames: readonly Frame[]): void {
    this.generation.applyOutcome(outcome);
    const inStory = new Set(frames.map((frame) => frame.photoId));
    const extras = this.story.userPicks().filter((id) => !inStory.has(id));
    if (extras.length) void this.generation.captionNewPhotos(extras);
  }

  /**
   * The story has landed. Whatever the model wrote is now known, so the reveal
   * stops taking on new full catches: the one in flight finishes, and every
   * choice that was never shown lands on the kept pile with its words already
   * set. Reading the rest out in full here would tell the whole story before the
   * user is let into it, and would add to a wait that is already over.
   *
   * The floor is one: if the model wrote everything so late that nothing was
   * caught during the wait, the first choice is still read out properly.
   */
  private async reveal(frames: readonly Frame[], look: string): Promise<void> {
    this.storyLanded = true;
    while (this.alive && this.pumping) await this.wait(60);
    if (!this.alive) return;

    if (this.revealed.size === 0 && frames.length > 0) {
      await this.catchFrame(frames[0], frames.length, look);
      if (!this.alive) return;
    }

    for (const frame of frames) {
      if (!this.alive) return;
      if (this.revealed.has(frame.photoId)) continue;
      const agreed = this.story.userPicks().includes(frame.photoId);
      const next = this.bring(frame, frames.length, agreed, look);
      if (!next) continue;
      next.reveal = { scrim: true, rule: true, kicker: true, words: next.type?.wordCount ?? 0 };
      next.print.held = false;
      this.engine.toKept(next.print, false);
      this.settleKept();
      this.revealed.add(frame.photoId);
      this.bump();
      await this.wait(DEAL_GAP_MS);
    }
  }

  /** Put the model's chosen photo on the table with its words set. A photo that
   * has already left the lane — the user pulled it down, or it drifted past — is
   * lifted back out of its pile and written on rather than dealt a second time. */
  private bring(
    frame: Frame,
    total: number | null,
    agreed: boolean,
    look: string | undefined,
  ): PrintView | null {
    const photo = this.story.photos().find((candidate) => candidate.id === frame.photoId);
    if (!photo) return null;
    const existing = this.engine.prints.find((print) => print.photoId === frame.photoId);
    const print = existing ?? this.engine.dealNamed({ id: photo.id, src: photo.previewUrl });
    if (existing && existing.pile !== 'lane') {
      this.engine.lift(existing);
      this.seenCount.set(this.engine.seenCount);
      this.keptCount.set(this.engine.kept.length - this.engine.myCount);
      this.myCount.set(this.engine.myCount);
    } else if (!existing) {
      print.y = this.geometry().h * 0.92;
    }
    this.sync();
    const view = this.viewOf(print);
    if (view) view.type = typeFor(frame, total, agreed, look);
    this.bump();
    return view ?? null;
  }

  /** Let the print drift up to the focal point on its own, and simply stop there. */
  private async driftToFocal(print: Print): Promise<void> {
    const focal = this.geometry().focal + 4;
    // Bounded: if the print has not arrived by now (a background tab froze the
    // loop, say), it is caught where it is rather than holding the story back.
    let guard = 120;
    while (this.alive && guard-- > 0 && print.y > focal && !print.grabbed) {
      await this.wait(40);
    }
  }

  /**
   * The catch: the lane eases to a stop (it never cuts), the rest of the table
   * blurs and recedes, the print comes forward — and only once it is completely
   * still do the words begin, one beat at a time.
   */
  private async catchIt(view: PrintView): Promise<void> {
    const print = view.print;
    const type = view.type;
    const beats = beatsFor(this.reduced);
    this.holding = true;
    print.held = true;
    print.settled = false;

    this.engine.vTarget = 0;
    await this.wait(this.reduced ? 1 : STOP_MS);
    if (!this.alive) return;

    this.engine.focusTarget = 1;
    this.chrome.set(false);
    this.hint.set(false);
    this.comeForward(print);
    await this.wait(this.reduced ? 200 : type?.agreed ? SETTLE_AGREED_MS : SETTLE_MS);
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
      await this.wait(type.agreed ? beats.kickerAgreed : beats.kicker);
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
    this.engine.toKept(print, false);
    this.settleKept();
    this.bump();
    await this.wait(this.reduced ? 200 : TO_PILE_MS);

    this.engine.focusTarget = 0;
    this.engine.vTarget = 1;
    this.chrome.set(true);
    this.holding = false;
    this.boost = 1;
  }

  /** The print comes forward to the focal point with a small overshoot. */
  private comeForward(print: Print): void {
    const element = this.elements.get(print.key);
    const geo = this.geometry();
    const from = element?.style.transform ?? '';
    this.engine.hold(print);
    const to = transformFor(print, geo);
    if (!element) return;
    this.play(
      element,
      this.reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { transform: from, offset: 0 },
            {
              transform: transform(geo, print.x, print.y, print.rot, print.scale * 1.022),
              offset: 0.74,
            },
            { transform: to, offset: 1 },
          ],
      this.reduced ? 260 : COME_FORWARD_MS,
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
    this.chrome.set(false);
    this.hint.set(false);
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
        const slot = print.slot ?? { x: geo.w / 2, y: geo.h, scale: 0.235 };
        const dx = slot.x - (left + width / 2);
        const dy = slot.y - 23.5;
        return {
          index: i,
          left,
          width,
          from:
            `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ` +
            `scale(${((geo.cardW * slot.scale) / width).toFixed(3)}, ${((geo.cardH * slot.scale) / 3).toFixed(3)})`,
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
            { transform: transform(geo, geo.w / 2, geo.h / 2, 0, geo.open), borderRadius: '0px' },
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
