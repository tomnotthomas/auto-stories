/**
 * The light table behind the generating screen: the user's own photos become
 * prints that drift up through the middle of the surface, land on a "seen" pile
 * at the top, and stack on a "kept" pile at the bottom. Pure state + geometry —
 * no DOM, no Angular — so every motion rule here is unit-testable and the
 * component is left with rendering and sequencing.
 */

/** A photo the lane can deal onto the table. */
export interface LanePhoto {
  readonly id: string;
  readonly src: string;
}

/** Which pile a print currently belongs to. */
export type Pile = 'lane' | 'seen' | 'kept';

/** One printed photo on the table. Mutable by design: the loop writes ~60×/s. */
export interface Print {
  /** Stable identity for `@for` tracking (a photo can be dealt only once). */
  readonly key: string;
  readonly photoId: string;
  readonly src: string;
  x: number;
  y: number;
  /** Resting rotation, in degrees. */
  rot: number;
  /** Per-print offset so the sideways sway doesn't move as one block. */
  phase: number;
  scale: number;
  opacity: number;
  /** Blur radius in px. */
  blur: number;
  /** Extra CSS filters that survive a repaint (the greyscale seen pile). */
  wash: string;
  pile: Pile;
  /** The model is holding this print at the focal point. */
  held: boolean;
  /** It has landed on a pile, so the loop no longer paints it. */
  settled: boolean;
  z: number;
  /** Where it came to rest on the kept pile (the ending morphs from here). */
  slot: { x: number; y: number; scale: number } | null;
}

/** Every landmark on the surface, in px, derived from its measured size. */
export interface LaneGeometry {
  readonly w: number;
  readonly h: number;
  readonly cardW: number;
  readonly cardH: number;
  /** A print above this line has left the lane. */
  readonly laneTop: number;
  /** Where a print is sharp, full size, and where the model catches it. */
  readonly focal: number;
  /** Distance from the focal point over which depth falls off. */
  readonly range: number;
  /** Scale that fills the surface — the first frame opening full-bleed. */
  readonly open: number;
}

/* ── The authored values, as ratios of the 390×844 surface they were set on ── */
const REF_W = 390;
const REF_H = 844;
const r = (px: number): number => px / REF_H;

/**
 * Reduced motion: how long each print is held before the next crossfades in.
 *
 * The screen's whole content is movement, so dropping the drift and stopping
 * there leaves four photos sitting still for the length of the wait — which
 * reads as a broken screen, not an accessible one. The lane keeps working
 * through the photos on this beat instead, in place: one print at a time,
 * changed by opacity alone, which is the part of the motion that is
 * vestibular-safe.
 */
export const REDUCED_HOLD_MS = 1600;

/** How many prints stay in flight. Topped up inside the loop, never by the
 * sequencer — the sequencer blocks while the model's print is being read. */
export const KEEP_IN_LANE = 4;
/** px/ms of vertical drift at the reference height, before decay. */
const DRIFT_PX_PER_S = 215;
/** The drift halves every this-many ms of waiting. */
const DECAY_MS = 19_000;
/** Scales, relative to the print's own size — surface-independent. */
const SCALE = {
  drift: 0.365,
  held: 0.94,
  laid: 0.235,
  seen: 0.112,
} as const;

export function geometryFor(w: number, h: number): LaneGeometry {
  const cardH = h * r(694);
  return {
    w,
    h,
    cardW: w,
    cardH,
    laneTop: h * r(128),
    focal: h * r(348),
    range: h * r(480),
    open: h / cardH,
  };
}

/** Vertical drift in px/ms, decaying with how long the user has been waiting. */
export function driftSpeed(geo: LaneGeometry, elapsedMs: number): number {
  const base = (DRIFT_PX_PER_S * (geo.h / REF_H)) / 1000;
  return base / (1 + elapsedMs / DECAY_MS);
}

/** A CSS transform that puts a print's *centre* at (x, y), then rotates and
 * scales it. The overshoots and the final open are built from this directly. */
export function transform(
  geo: LaneGeometry,
  x: number,
  y: number,
  rot: number,
  scale: number,
): string {
  return (
    `translate3d(${round(x - geo.cardW / 2)}px, ${round(y - geo.cardH / 2)}px, 0) ` +
    `rotate(${round(rot)}deg) scale(${round(scale)})`
  );
}

/** Where a print is right now, plus any sideways sway. */
export function transformFor(print: Print, geo: LaneGeometry, sway = 0): string {
  return transform(geo, print.x + sway, print.y, print.rot, print.scale);
}

/** How finely the depth blur is stepped. A blur is re-rendered whenever its
 * radius changes, so holding the radius still for a few frames at a time lets
 * the compositor reuse what it already drew — free on a fast GPU, the
 * difference between smooth and choppy on a slow one. */
const BLUR_STEP_PX = 0.5;

/** The print's CSS filter — depth blur plus any pile wash. */
export function filterFor(print: Print): string {
  const stepped = Math.round(print.blur / BLUR_STEP_PX) * BLUR_STEP_PX;
  const blur = stepped >= BLUR_STEP_PX ? `blur(${stepped}px)` : '';
  return [blur, print.wash].filter(Boolean).join(' ') || 'none';
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round = (v: number): number => Math.round(v * 1000) / 1000;

interface LaneOptions {
  /** Reduced motion: no drift, no sway, no depth blur — the fades stay. */
  readonly reduced?: boolean;
  readonly random?: () => number;
}

export class LaneEngine {
  /** Every print dealt so far, in deal order — the render list. */
  readonly prints: Print[] = [];
  readonly lane: Print[] = [];
  readonly seen: Print[] = [];
  readonly kept: Print[] = [];

  /** Where the lane speed is heading (1 = full, 0.2 = a crawl, 0 = stopped). */
  vTarget = 1;
  /** The eased speed itself — it never cuts, it eases. */
  vScale = 1;
  /** Where the rack focus is heading (1 = everything else recedes). */
  focusTarget = 0;
  focus = 0;
  private pool: readonly LanePhoto[] = [];
  private next = 0;
  /** Reduced motion: time since the last print was retired. */
  private held = 0;
  /** The device could not afford the depth blur, so the lane stopped asking. */
  private lightened = false;
  private readonly reduced: boolean;
  private readonly random: () => number;

  constructor(
    private geo: LaneGeometry,
    options: LaneOptions = {},
  ) {
    this.reduced = options.reduced ?? false;
    this.random = options.random ?? Math.random;
  }

  /** How many prints the user has looked past. */
  get seenCount(): number {
    return this.seen.length;
  }

  /** No unseen photos left to deal — the lane is running out. */
  get poolExhausted(): boolean {
    return this.next >= this.pool.length;
  }

  /** True once the lane has nothing left to show and is about to go quiet. */
  get runningDry(): boolean {
    return this.poolExhausted && this.lane.length <= 1;
  }

  /** The photos to deal, in the order they should appear. */
  setPool(photos: readonly LanePhoto[]): void {
    this.pool = photos;
    this.next = 0;
  }

  /** Fill the lane so the screen is never empty on the first frame. */
  seed(): void {
    for (let k = 0; k < KEEP_IN_LANE && !this.poolExhausted; k++) {
      const print = this.deal();
      if (!print) return;
      // Reduced motion shows one print at a time in place, so they stack on the
      // focal point instead of being strung out up the lane.
      print.y = this.reduced ? this.geo.focal : this.geo.h * 0.98 - k * this.geo.h * r(206);
      this.paint(print);
    }
    if (this.reduced) this.repaintLane();
  }

  /**
   * The surface changed size — an Android URL bar collapsing is enough to do it.
   * Every print keeps its place proportionally and the piles are refanned, so
   * the lane's landmarks and its contents stay in the same coordinate space.
   */
  resize(geo: LaneGeometry): void {
    const sx = geo.w / this.geo.w;
    const sy = geo.h / this.geo.h;
    this.geo = geo;
    // A print still in the lane keeps its place proportionally; a print on a
    // pile is laid out again from the pile's own rule, so nothing drifts.
    for (const print of this.lane) {
      print.x *= sx;
      print.y *= sy;
      this.paint(print);
    }
    this.seen.forEach((print, i) => this.layOnSeenPile(print, i + 1));
    if (this.kept.length) this.restack();
    if (this.reduced) this.repaintLane();
  }

  /** Deal the next pooled photo into the lane. */
  deal(): Print | null {
    const photo = this.pool[this.next];
    if (!photo) return null;
    this.next++;
    return this.create(photo);
  }

  /** Deal a specific photo (the model's pick). A photo already on the table is
   * returned as-is, so the same print is never dealt twice. */
  dealNamed(photo: LanePhoto): Print {
    return this.prints.find((print) => print.photoId === photo.id) ?? this.create(photo);
  }

  private create(photo: LanePhoto): Print {
    const print: Print = {
      key: photo.id,
      photoId: photo.id,
      src: photo.src,
      x: this.geo.w / 2 + (this.random() * 2 - 1) * this.geo.w * (40 / REF_W),
      y: this.geo.h + this.geo.cardH * SCALE.drift * 0.55,
      rot: (this.random() * 2 - 1) * 3.6,
      phase: this.random() * 6.28,
      scale: SCALE.drift,
      opacity: 1,
      blur: 0,
      wash: '',
      pile: 'lane',
      held: false,
      settled: false,
      z: 3,
      slot: null,
    };
    this.prints.push(print);
    this.lane.push(print);
    this.paint(print);
    return print;
  }

  /** One frame of the loop. Returns the prints that left the lane this frame. */
  step(dtMs: number, elapsedMs: number): { tucked: Print[] } {
    const dt = Math.min(50, dtMs);
    const ease = (tau: number): number => 1 - Math.exp(-dt / tau);
    // One continuously-eased value drives the lane speed; another drives how far
    // the rest of the table recedes. Slowing is quicker than speeding up.
    this.vScale += (this.vTarget - this.vScale) * ease(this.vTarget < this.vScale ? 105 : 190);
    this.focus += (this.focusTarget - this.focus) * ease(this.focusTarget > this.focus ? 150 : 105);

    const tucked: Print[] = [];
    if (this.reduced) {
      // No drift: the lane advances on a beat instead, one print at a time.
      this.held += dt;
      const front = this.lane.find((print) => !print.held);
      if (this.held >= REDUCED_HOLD_MS && front && this.lane.length > 1) {
        this.held = 0;
        this.toSeen(front);
        tucked.push(front);
      }
      if (this.inFlight < KEEP_IN_LANE && !this.poolExhausted) this.deal();
      this.repaintLane();
      return { tucked };
    }

    const v = driftSpeed(this.geo, elapsedMs) * this.vScale;
    for (let i = this.lane.length - 1; i >= 0; i--) {
      const print = this.lane[i];
      if (print.held) continue;
      print.y -= v * dt;
      this.paint(print);
      if (print.y < this.geo.laneTop) {
        this.toSeen(print);
        tucked.push(print);
      }
    }
    // Top up from inside the loop, never from the sequencer — the sequencer is
    // blocked while the model's print is being read.
    if (this.inFlight < KEEP_IN_LANE && !this.poolExhausted) this.deal();
    return { tucked };
  }

  private get inFlight(): number {
    return this.lane.filter((print) => !print.held).length;
  }

  /** Recompute a lane print's depth from where it sits relative to the focal
   * point, and how far the rest has been pushed back by the rack focus. */
  /** Reduced motion: only the print at the front of the queue is shown, so the
   * beat that retires it reads as one photo crossfading into the next. */
  private repaintLane(): void {
    const front = this.lane.find((print) => !print.held);
    for (const print of this.lane) {
      if (print.held) continue;
      print.y = this.geo.focal;
      print.opacity = print === front ? 1 : 0;
    }
  }

  paint(print: Print): void {
    const t = clamp(Math.abs(print.y - this.geo.focal) / this.geo.range, 0, 1);
    print.scale = SCALE.drift * (1 - 0.24 * t) * (1 - 0.07 * this.focus);
    print.blur = this.reduced || this.lightened ? 0 : 5.5 * t * t + 12 * this.focus;
    print.opacity = clamp((1 - 1.05 * Math.pow(t, 1.8)) * (1 - 0.86 * this.focus), 0.02, 1);
  }

  /**
   * Stop asking for the depth blur — the device cannot hold the frame budget
   * with it (decision 7.34). Depth is still read from scale and opacity, which
   * cost nothing, so the lane keeps its shape; it just loses its softness. One
   * way: a screen that flickered between sharp and soft would be worse than
   * either.
   */
  lighten(): void {
    if (this.lightened) return;
    this.lightened = true;
    for (const print of this.lane) this.paint(print);
  }

  /** True once the depth blur has been shed. */
  get isLightened(): boolean {
    return this.lightened;
  }

  /** Sideways sway, in px — a print on a table is never perfectly on rails. */
  swayFor(print: Print): number {
    if (this.reduced || print.held || print.settled) return 0;
    return (
      Math.sin(print.y * (0.0062 * (REF_H / this.geo.h)) + print.phase) * this.geo.w * (15 / REF_W)
    );
  }

  /* ── the piles ─────────────────────────────────────────────────────────── */

  /** Toss a print onto the dim pile at the top edge. */
  toSeen(print: Print): void {
    this.leaveLane(print);
    this.seen.push(print);
    print.pile = 'seen';
    this.layOnSeenPile(print, this.seen.length);
    print.scale = SCALE.seen;
    print.opacity = 0.66;
    print.blur = 0;
    print.wash = 'grayscale(1) brightness(.92)';
    print.z = 1;
    print.settled = true;
  }

  /** Where the nth print sits on the seen pile. Scattered, but from a rule, so
   * the pile can be laid out again from scratch when the surface changes size. */
  private layOnSeenPile(print: Print, n: number): void {
    print.x = this.geo.w * (34 / REF_W) + ((n * 61) % (this.geo.w - this.geo.w * (68 / REF_W)));
    print.y = this.geo.h * r(46) + ((n * 29) % 26) * (this.geo.h / REF_H);
    print.rot = ((n * 41) % 22) - 11;
  }

  /** Lay a print on the kept pile at the bottom and refan the stack. */
  toKept(print: Print): void {
    this.leaveLane(print);
    this.kept.push(print);
    print.pile = 'kept';
    print.held = false;
    print.wash = '';
    print.blur = 0;
    print.opacity = 1;
    this.restack();
  }

  /**
   * Take a print back off a pile and into the lane. The model has chosen a photo
   * that already left — either the user pulled it down (it agreed with them) or
   * it drifted past — so that print is lifted and written on rather than the same
   * photo being dealt a second time. It loses the pile's wash on the way out.
   */
  lift(print: Print): void {
    const wasKept = print.pile === 'kept';
    const from = wasKept ? this.kept : this.seen;
    const at = from.indexOf(print);
    if (at >= 0) from.splice(at, 1);
    print.pile = 'lane';
    print.settled = false;
    print.slot = null;
    print.wash = '';
    print.opacity = 1;
    print.z = 3;
    // It comes back above the lane's own top, so it is held from the moment it
    // is lifted — otherwise the next frame would tuck it straight back.
    print.held = true;
    this.lane.push(print);
    if (wasKept) this.restack();
  }

  /** Put the kept pile in the story's own order, so the bars it flattens into
   * read left to right the way the story does. A print the story does not name
   * (one the user kept and the model did not use) keeps its place at the end. */
  arrangeKept(photoIds: readonly string[]): void {
    const named = new Map(photoIds.map((id, i) => [id, i]));
    const rank = new Map(
      this.kept.map((print, i) => [print, named.get(print.photoId) ?? named.size + i]),
    );
    this.kept.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
    this.restack();
  }

  /** Hold a print still at the focal point while the model's line is written. */
  hold(print: Print): void {
    print.held = true;
    print.settled = false;
    print.rot = 0;
    print.x = this.geo.w / 2;
    print.y = this.geo.h * 0.4;
    print.scale = SCALE.held;
    print.blur = 0;
    print.opacity = 1;
    print.wash = '';
    print.z = 5;
  }

  /** The scale a print reaches while the model holds it. */
  get heldScale(): number {
    return SCALE.held;
  }

  /** Fan the kept pile: newest print in front, the ones behind it stepped back. */
  restack(): void {
    const n = this.kept.length;
    this.kept.forEach((print, i) => {
      const back = n - 1 - i;
      const scale = SCALE.laid * (back === 0 ? 1.1 : 1 - Math.min(back, 5) * 0.03);
      const x = this.geo.w / 2 + (i - (n - 1) / 2) * this.geo.w * (47 / REF_W);
      const y = this.geo.h - this.geo.h * r(88) - (back === 0 ? this.geo.h * r(12) : 0);
      print.x = x;
      print.y = y;
      print.rot = (i - (n - 1) / 2) * 2.4;
      print.scale = scale;
      print.opacity = 1;
      print.blur = 0;
      print.wash = back === 0 ? '' : `brightness(${round(1 - Math.min(back, 4) * 0.08)})`;
      print.z = 7 + i;
      print.settled = true;
      print.slot = { x, y, scale };
    });
  }

  private leaveLane(print: Print): void {
    const at = this.lane.indexOf(print);
    if (at >= 0) this.lane.splice(at, 1);
    print.held = false;
  }
}
