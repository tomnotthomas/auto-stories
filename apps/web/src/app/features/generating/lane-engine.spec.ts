import {
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
    expect(large.focal / small.focal).toBeCloseTo(2);
  });

  it('keeps the authored landmarks at the reference size', () => {
    expect(GEO.cardH).toBeCloseTo(694, 0);
    expect(GEO.laneTop).toBeCloseTo(128, 0);
    expect(GEO.focal).toBeCloseTo(348, 0);
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

describe('LaneEngine — the piles', () => {
  it('fans the kept pile with the newest print in front', () => {
    const lane = engine();
    const [a, b] = lane.lane;
    lane.toKept(a);
    lane.toKept(b);
    expect(lane.kept).toEqual([a, b]);
    expect(b.scale).toBeGreaterThan(a.scale);
    expect(b.z).toBeGreaterThan(a.z);
  });

  it('lifts a print back out of the kept pile when the model comes back to it', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.toKept(print);

    lane.lift(print);
    expect(lane.kept).not.toContain(print);
    expect(lane.lane).toContain(print);
  });

  it('lifts a print the model chose after it had already drifted past, without its wash', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.toSeen(print);
    expect(print.wash).not.toBe('');

    lane.lift(print);
    expect(lane.seen).not.toContain(print);
    expect(lane.seenCount).toBe(0);
    expect(lane.lane).toContain(print);
    expect(print.wash).toBe('');
    expect(print.settled).toBe(false);
  });

  it('does not let a lifted print fall straight back onto the pile it came from', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.toSeen(print);
    lane.lift(print);

    run(lane, 320, 16);

    expect(print.pile).toBe('lane');
    expect(lane.seen).not.toContain(print);
  });

  it('puts the kept pile in the story’s order, extras last', () => {
    const lane = engine();
    const [a, b, c] = lane.lane;
    lane.toKept(a);
    lane.toKept(b);
    lane.toKept(c);

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
    print.scale = 0.5;
    expect(transformFor(print, GEO)).toBe(
      `translate3d(${195 - GEO.cardW / 2}px, ${400 - GEO.cardH / 2}px, 0) rotate(0deg) scale(0.5)`,
    );
  });

  it('carries the sway as a sideways offset', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.x = 195;
    expect(transformFor(print, GEO, 12)).toBe(transform(GEO, 207, print.y, print.rot, print.scale));
  });
});
