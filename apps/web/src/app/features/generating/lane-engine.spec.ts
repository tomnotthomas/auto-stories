import {
  DROP_FLICK,
  KEEP_IN_LANE,
  LaneEngine,
  driftSpeed,
  geometryFor,
  transform,
  transformFor,
  type LanePhoto,
  type Print,
} from './lane-engine';

/** A phone-shaped surface — the size the motion values were authored against. */
const GEO = geometryFor(390, 844);

function photos(count: number): LanePhoto[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, src: `blob:${i + 1}` }));
}

/** Deterministic scatter so positions are assertable. */
function engine(pool = photos(8), reduced = false): LaneEngine {
  const lane = new LaneEngine(GEO, { reduced, random: () => 0.5 });
  lane.setPool(pool);
  lane.seed();
  return lane;
}

/** Run the loop for `ms` in 16ms frames. */
function run(lane: LaneEngine, ms: number, from = 0): void {
  for (let t = 0; t < ms; t += 16) lane.step(16, from + t);
}

describe('lane geometry', () => {
  it('sizes the print and the piles in proportion to the surface', () => {
    const small = geometryFor(390, 844);
    const large = geometryFor(780, 1688);
    expect(large.cardW / small.cardW).toBeCloseTo(2);
    expect(large.cardH / small.cardH).toBeCloseTo(2);
    expect(large.laneTop / small.laneTop).toBeCloseTo(2);
    expect(large.dropKeep / small.dropKeep).toBeCloseTo(2);
  });

  it('keeps the authored landmarks at the reference size', () => {
    expect(GEO.cardH).toBeCloseTo(694, 0);
    expect(GEO.laneTop).toBeCloseTo(128, 0);
    expect(GEO.focal).toBeCloseTo(348, 0);
    expect(GEO.dropKeep).toBeCloseTo(844 - 262, 0);
    expect(GEO.dropPass).toBeCloseTo(128 + 96, 0);
  });
});

describe('drift speed', () => {
  it('decays as the wait goes on', () => {
    const start = driftSpeed(GEO, 0);
    const later = driftSpeed(GEO, 19_000);
    expect(later).toBeCloseTo(start / 2, 5);
    expect(driftSpeed(GEO, 38_000)).toBeLessThan(later);
  });

  it('scales with the surface so a taller screen drifts proportionally', () => {
    expect(driftSpeed(geometryFor(780, 1688), 0)).toBeCloseTo(driftSpeed(GEO, 0) * 2, 5);
  });
});

describe('LaneEngine — the lane', () => {
  it('starts with a full lane of overlapping prints', () => {
    const lane = engine();
    expect(lane.lane.length).toBe(KEEP_IN_LANE);
    expect(new Set(lane.lane.map((p) => p.y)).size).toBe(KEEP_IN_LANE);
  });

  it('tops the lane up from inside the loop as prints leave it', () => {
    const lane = engine();
    const [first] = lane.lane;
    first.y = GEO.laneTop - 1;
    const { tucked } = lane.step(16, 16);
    expect(tucked).toContain(first);
    expect(lane.lane.length).toBe(KEEP_IN_LANE);
  });

  it('drifts prints upward', () => {
    const lane = engine();
    const print = lane.lane[0];
    const before = print.y;
    run(lane, 320, 16);
    expect(print.y).toBeLessThan(before);
  });

  it('stops dealing once the photo pool is used up', () => {
    const lane = engine(photos(2));
    expect(lane.lane.length).toBe(2);
    expect(lane.poolExhausted).toBe(true);
  });

  it('moves a print that reaches the top onto the seen pile', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.y = GEO.laneTop - 1;
    lane.step(16, 16);
    expect(print.pile).toBe('seen');
    expect(lane.seen).toContain(print);
    expect(lane.seenCount).toBe(1);
  });
});

describe('LaneEngine — depth', () => {
  it('makes prints away from the focal point smaller, dimmer and blurrier', () => {
    const lane = engine();
    const [near, far] = lane.lane;
    near.y = GEO.focal;
    far.y = GEO.focal + GEO.range;
    lane.paint(near);
    lane.paint(far);
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.blur).toBeGreaterThan(near.blur);
  });

  it('pushes the rest back and blurs them when focus is pulled (rack focus)', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.y = GEO.focal;
    lane.paint(print);
    const { scale, opacity, blur } = print;

    lane.vTarget = 0;
    lane.focusTarget = 1;
    run(lane, 600, 16);
    expect(print.scale).toBeLessThan(scale);
    expect(print.opacity).toBeLessThan(opacity);
    expect(print.blur).toBeGreaterThan(blur);
  });

  it('drops drift and blur under reduced motion but keeps the print visible', () => {
    const lane = engine(photos(8), true);
    const print = lane.lane[0];
    const before = print.y;
    run(lane, 480, 16);
    expect(print.y).toBe(before);
    expect(print.blur).toBe(0);
    expect(print.opacity).toBeGreaterThan(0);
  });
});

describe('LaneEngine — grabbing a print', () => {
  function grabbed(): { lane: LaneEngine; print: Print } {
    const lane = engine();
    const print = lane.lane[0];
    print.y = GEO.focal;
    lane.grab(print, 195, GEO.focal, 0);
    return { lane, print };
  }

  it('slows the lane to a crawl while a print is held', () => {
    const { lane } = grabbed();
    expect(lane.vTarget).toBeCloseTo(0.2);
  });

  it('ignores a second finger while one print is already held', () => {
    const { lane, print } = grabbed();
    const other = lane.lane[1];
    expect(lane.grab(other, 100, 400, 0)).toBe(false);
    expect(other.grabbed).toBe(false);
    expect(print.grabbed).toBe(true);
  });

  it('will not grab a print that has already settled on a pile', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.toSeen(print);
    expect(lane.grab(print, 100, 100, 0)).toBe(false);
  });

  it('leans the print into the drag, clamped', () => {
    const { lane, print } = grabbed();
    lane.drag(295, GEO.focal, 16);
    expect(print.tilt).toBeCloseTo(5);
    lane.drag(695, GEO.focal, 32);
    expect(print.tilt).toBe(11);
    lane.drag(-305, GEO.focal, 48);
    expect(print.tilt).toBe(-11);
  });

  it('damps the pull past a pile instead of hitting a wall', () => {
    const { lane, print } = grabbed();
    lane.drag(195, GEO.laneTop - 200, 16);
    expect(print.y).toBeGreaterThan(GEO.laneTop - 200);
    expect(print.y).toBeLessThan(GEO.laneTop);
  });

  it('arms the pile the print would drop into', () => {
    const { lane } = grabbed();
    expect(lane.armed).toBeNull();
    lane.drag(195, GEO.dropKeep + 20, 16);
    expect(lane.armed).toBe('keep');
    lane.drag(195, GEO.dropPass - 20, 320);
    expect(lane.armed).toBe('pass');
  });

  it('keeps the print as the user’s pick when it is pulled past the kept pile', () => {
    const { lane, print } = grabbed();
    lane.drag(195, GEO.dropKeep + 20, 400);
    expect(lane.release()).toBe('kept');
    expect(print.mine).toBe(true);
    expect(print.pile).toBe('kept');
    expect(lane.myCount).toBe(1);
  });

  it('passes the print when it is pushed past the seen pile', () => {
    const { lane, print } = grabbed();
    lane.drag(195, GEO.dropPass - 20, 400);
    expect(lane.release()).toBe('passed');
    expect(print.pile).toBe('seen');
  });

  it('springs the print back when it is released in between', () => {
    const { lane, print } = grabbed();
    lane.drag(195, GEO.focal + 10, 400);
    expect(lane.release()).toBe('returned');
    expect(print.pile).toBe('lane');
    expect(print.grabbed).toBe(false);
    expect(print.tilt).toBe(0);
  });

  it('counts a downward flick even when the line was never crossed', () => {
    const { lane, print } = grabbed();
    lane.drag(195, GEO.focal + (DROP_FLICK * 40 + 4), 40);
    expect(lane.release()).toBe('kept');
    expect(print.mine).toBe(true);
  });

  it('counts an upward flick even when the line was never crossed', () => {
    const { lane, print } = grabbed();
    lane.drag(195, GEO.focal - (DROP_FLICK * 40 + 4), 40);
    expect(lane.release()).toBe('passed');
    expect(print.pile).toBe('seen');
  });

  it('restores the lane speed and disarms the piles on release', () => {
    const { lane } = grabbed();
    lane.drag(195, GEO.focal + 10, 400);
    lane.release();
    expect(lane.vTarget).toBe(1);
    expect(lane.armed).toBeNull();
  });
});

describe('LaneEngine — the piles', () => {
  it('fans the kept pile with the newest print in front', () => {
    const lane = engine();
    const [a, b] = lane.lane;
    lane.toKept(a, true);
    lane.toKept(b, true);
    expect(lane.kept).toEqual([a, b]);
    expect(b.scale).toBeGreaterThan(a.scale);
    expect(b.z).toBeGreaterThan(a.z);
  });

  it('lifts the user’s own print back out of the kept pile when the model agrees', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.toKept(print, true);
    expect(lane.myCount).toBe(1);

    lane.liftFromKept(print);
    expect(lane.kept).not.toContain(print);
    expect(print.mine).toBe(false);
    expect(lane.myCount).toBe(0);
    expect(lane.lane).toContain(print);
  });

  it('puts the kept pile in the story’s order, extras last', () => {
    const lane = engine();
    const [a, b, c] = lane.lane;
    lane.toKept(a, true);
    lane.toKept(b, false);
    lane.toKept(c, false);

    lane.arrangeKept([c.photoId, b.photoId]);

    expect(lane.kept).toEqual([c, b, a]);
  });

  it('holds a print at the focal point for the model’s turn', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.hold(print);
    const before = print.y;
    run(lane, 320, 16);
    expect(print.y).toBe(before);
    expect(print.held).toBe(true);
  });
});

describe('transformFor', () => {
  it('positions the print by its centre and carries rotation and scale', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.x = 195;
    print.y = 400;
    print.rot = 0;
    print.tilt = 0;
    print.scale = 0.5;
    expect(transformFor(print, GEO)).toBe(
      `translate3d(${195 - GEO.cardW / 2}px, ${400 - GEO.cardH / 2}px, 0) rotate(0deg) scale(0.5)`,
    );
  });

  it('carries the sway as a sideways offset', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.x = 195;
    print.tilt = 0;
    expect(transformFor(print, GEO, 12)).toBe(transform(GEO, 207, print.y, print.rot, print.scale));
  });
});
