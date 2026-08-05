/**
 * The light table behind the generating screen: the user's own photos become
 * prints that drift up through the middle of the surface, land on a "seen" pile
 * at the top, and stack on a "kept" pile at the bottom. Pure state + geometry —
 * no DOM, no Angular — so every motion rule here is unit-testable and the
 * component is left with rendering, gestures and sequencing.
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
  /** Extra rotation from the drag, in degrees. */
  tilt: number;
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
  /** A finger has this print. */
  grabbed: boolean;
  /** It has landed on a pile, so the loop no longer paints it. */
  settled: boolean;
  /** The user pulled this print down themselves. */
  mine: boolean;
  /** It was flicked onto the seen pile rather than drifting off — a faster toss. */
  flung: boolean;
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
  /** Released below this → kept. */
  readonly dropKeep: number;
  /** Released above this → passed. */
  readonly dropPass: number;
  /** Below this the drag is damped instead of walled. */
  readonly dragFloor: number;
  /** Scale that fills the surface — the first frame opening full-bleed. */
  readonly open: number;
}

/* ── The authored values, as ratios of the 390×844 surface they were set on ── */
const REF_W = 390;
const REF_H = 844;
const r = (px: number): number => px / REF_H;

/** How many prints stay in flight. Topped up inside the loop, never by the
 * sequencer — the sequencer blocks while the model's print is being read. */
export const KEEP_IN_LANE = 4;
/** px/ms of vertical drift at the reference height, before decay. */
const DRIFT_PX_PER_S = 215;
/** The drift halves every this-many ms of waiting. */
const DECAY_MS = 19_000;
/** A toss this fast (px/ms) commits even if the line was never crossed. */
export const DROP_FLICK = 0.11;

/** Scales, relative to the print's own size — surface-independent. */
const SCALE = {
  drift: 0.365,
  grabbed: 0.425,
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
    dropKeep: h - h * r(262),
    dropPass: h * r(128) + h * r(96),
    dragFloor: h - h * r(150),
    open: h / cardH,
  };
}

/** Vertical drift in px/ms, decaying with how long the user has been waiting. */
export function driftSpeed(geo: LaneGeometry, elapsedMs: number): number {
  const base = (DRIFT_PX_PER_S * (geo.h / REF_H)) / 1000;
  return base / (1 + elapsedMs / DECAY_MS);
}

/** The print's CSS transform: positioned by its centre, then rotated + scaled. */
export function transformFor(print: Print, geo: LaneGeometry): string {
  const x = print.x - geo.cardW / 2;
  const y = print.y - geo.cardH / 2;
  const rot = print.rot + print.tilt;
  return `translate3d(${round(x)}px, ${round(y)}px, 0) rotate(${round(rot)}deg) scale(${round(print.scale)})`;
}

/** The print's CSS filter — depth blur plus any pile wash. */
export function filterFor(print: Print): string {
  const blur = print.blur > 0.01 ? `blur(${round(print.blur)}px)` : '';
  return [blur, print.wash].filter(Boolean).join(' ') || 'none';
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round = (v: number): number => Math.round(v * 1000) / 1000;

interface LaneOptions {
  /** Reduced motion: no drift, no sway, no depth blur — the fades stay. */
  readonly reduced?: boolean;
  readonly random?: () => number;
}

/** What a release committed to, or `returned` when it goes back to the lane. */
export type ReleaseResult = 'kept' | 'passed' | 'returned';

interface DragState {
  readonly print: Print;
  readonly originX: number;
  readonly originY: number;
  readonly fromX: number;
  readonly fromY: number;
  lastY: number;
  lastT: number;
  vy: number;
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
  /** The pile lit up because releasing now would drop into it. */
  armed: 'keep' | 'pass' | null = null;

  private pool: readonly LanePhoto[] = [];
  private next = 0;
  private gesture: DragState | null = null;
  private readonly reduced: boolean;
  private readonly random: () => number;

  constructor(
    private readonly geo: LaneGeometry,
    options: LaneOptions = {},
  ) {
    this.reduced = options.reduced ?? false;
    this.random = options.random ?? Math.random;
  }

  /** How many prints the user has looked past. */
  get seenCount(): number {
    return this.seen.length;
  }

  /** How many kept prints the user pulled down themselves. */
  get myCount(): number {
    return this.kept.filter((print) => print.mine).length;
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
      print.y = this.geo.h * 0.98 - k * this.geo.h * r(206);
      this.paint(print);
    }
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
      tilt: 0,
      phase: this.random() * 6.28,
      scale: SCALE.drift,
      opacity: 1,
      blur: 0,
      wash: '',
      pile: 'lane',
      held: false,
      grabbed: false,
      settled: false,
      mine: false,
      flung: false,
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

    const v = this.reduced ? 0 : driftSpeed(this.geo, elapsedMs) * this.vScale;
    const tucked: Print[] = [];
    for (let i = this.lane.length - 1; i >= 0; i--) {
      const print = this.lane[i];
      if (print.held || print.grabbed) continue;
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
    return this.lane.filter((print) => !print.held && !print.grabbed).length;
  }

  /** Recompute a lane print's depth from where it sits relative to the focal
   * point, and how far the rest has been pushed back by the rack focus. */
  paint(print: Print): void {
    if (print.grabbed) {
      print.scale = SCALE.grabbed;
      print.blur = 0;
      print.opacity = 1;
      return;
    }
    const t = clamp(Math.abs(print.y - this.geo.focal) / this.geo.range, 0, 1);
    print.scale = SCALE.drift * (1 - 0.24 * t) * (1 - 0.07 * this.focus);
    print.blur = this.reduced ? 0 : 5.5 * t * t + 12 * this.focus;
    print.opacity = clamp((1 - 1.05 * Math.pow(t, 1.8)) * (1 - 0.86 * this.focus), 0.02, 1);
  }

  /** Sideways sway, in px — a print on a table is never perfectly on rails. */
  swayFor(print: Print): number {
    if (this.reduced || print.grabbed || print.held || print.settled) return 0;
    return Math.sin(print.y * (0.0062 * (REF_H / this.geo.h)) + print.phase) * this.geo.w * (15 / REF_W);
  }

  /* ── the gesture ───────────────────────────────────────────────────────── */

  /** Take hold of a drifting print. One at a time: a second finger is ignored. */
  grab(print: Print, clientX: number, clientY: number, now: number): boolean {
    if (this.gesture) return false;
    if (print.held || print.settled || print.pile !== 'lane') return false;
    print.grabbed = true;
    print.tilt = 0;
    print.z = 20;
    this.gesture = {
      print,
      originX: clientX,
      originY: clientY,
      fromX: print.x,
      fromY: print.y,
      lastY: clientY,
      lastT: now,
      vy: 0,
    };
    // The world reacts to the finger: the lane crawls and softens behind it.
    this.vTarget = 0.2;
    this.focusTarget = 0.45;
    this.paint(print);
    return true;
  }

  get dragging(): boolean {
    return this.gesture !== null;
  }

  /** Move the held print, damping it past either pile rather than walling it. */
  drag(clientX: number, clientY: number, now: number): void {
    const drag = this.gesture;
    if (!drag) return;
    const dx = clientX - drag.originX;
    const dy = clientY - drag.originY;
    let y = drag.fromY + dy;
    if (y < this.geo.laneTop) y = this.geo.laneTop - (this.geo.laneTop - y) * 0.4;
    if (y > this.geo.dragFloor) y = this.geo.dragFloor + (y - this.geo.dragFloor) * 0.4;
    drag.print.x = drag.fromX + dx;
    drag.print.y = y;
    drag.print.tilt = clamp(dx * 0.05, -11, 11);
    if (now > drag.lastT) {
      drag.vy = (clientY - drag.lastY) / (now - drag.lastT);
      drag.lastY = clientY;
      drag.lastT = now;
    }
    this.armed = this.wouldKeep(drag) ? 'keep' : this.wouldPass(drag) ? 'pass' : null;
    this.paint(drag.print);
  }

  private wouldKeep(drag: DragState): boolean {
    return drag.print.y > this.geo.dropKeep || drag.vy > DROP_FLICK;
  }

  private wouldPass(drag: DragState): boolean {
    return drag.print.y < this.geo.dropPass || drag.vy < -DROP_FLICK;
  }

  /** Let go. Past a pile — or flicked at it — commits; anything else goes back. */
  release(): ReleaseResult | null {
    const drag = this.gesture;
    if (!drag) return null;
    this.gesture = null;
    this.armed = null;
    this.vTarget = 1;
    this.focusTarget = 0;
    this.releaseKick = clamp(drag.vy * 40, -11, 11);
    const print = drag.print;
    print.grabbed = false;
    print.z = 3;
    if (this.wouldKeep(drag)) {
      this.toKept(print, true);
      return 'kept';
    }
    if (this.wouldPass(drag)) {
      this.toSeen(print, true);
      return 'passed';
    }
    print.tilt = 0;
    this.paint(print);
    return 'returned';
  }

  /** The rotation the last returning print springs back from, so a release reads
   * as a release and not a snap. */
  releaseKick = 0;

  /* ── the piles ─────────────────────────────────────────────────────────── */

  /** Toss a print onto the dim pile at the top edge. */
  toSeen(print: Print, flung = false): void {
    this.leaveLane(print);
    this.seen.push(print);
    print.pile = 'seen';
    const n = this.seen.length;
    print.x = this.geo.w * (34 / REF_W) + ((n * 61) % (this.geo.w - this.geo.w * (68 / REF_W)));
    print.y = this.geo.h * r(46) + ((n * 29) % 26) * (this.geo.h / REF_H);
    print.rot = ((n * 41) % 22) - 11;
    print.tilt = 0;
    print.scale = SCALE.seen;
    print.opacity = 0.66;
    print.blur = 0;
    print.wash = 'grayscale(1) brightness(.92)';
    print.z = 1;
    print.settled = true;
    print.flung = flung;
  }

  /** Lay a print on the kept pile at the bottom and refan the stack. */
  toKept(print: Print, mine: boolean): void {
    this.leaveLane(print);
    this.kept.push(print);
    print.pile = 'kept';
    print.mine = mine;
    print.held = false;
    print.wash = '';
    print.blur = 0;
    print.opacity = 1;
    this.restack();
  }

  /** Take the user's own print back out of the kept pile — the model agreed with
   * them, so it is lifted and written on rather than dealt a second time. */
  liftFromKept(print: Print): void {
    const at = this.kept.indexOf(print);
    if (at >= 0) this.kept.splice(at, 1);
    print.mine = false;
    print.pile = 'lane';
    print.settled = false;
    print.slot = null;
    this.lane.push(print);
    this.restack();
  }

  /** Hold a print still at the focal point while the model's line is written. */
  hold(print: Print): void {
    print.held = true;
    print.settled = false;
    print.grabbed = false;
    print.tilt = 0;
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
      print.tilt = 0;
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
    print.grabbed = false;
    print.held = false;
  }
}
