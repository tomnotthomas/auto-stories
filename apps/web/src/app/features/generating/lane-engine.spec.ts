import {
  DEFAULT_ASPECT,
  KEEP_IN_LANE,
  boxFor,
  filterFor,
  openFor,
  REDUCED_HOLD_MS,
  LaneEngine,
  driftSpeed,
  geometryFor,
  transform,
  transformFor,
  type LaneGeometry,
  type LanePhoto,
  type Print,
} from './lane-engine';

/** A phone-shaped surface — the size the motion values were authored against. */
const GEO = geometryFor(390, 844);

/** The surface the shape defects were measured on, and the shape of the photos
 * that showed them (810×1440). */
const MEASURED = geometryFor(406, 752);
const TALL = 810 / 1440;
const WIDE = 1.5;

function photos(count: number): LanePhoto[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, src: `blob:${i + 1}` }));
}

/** Deterministic scatter so positions are assertable. */
function engine(pool = photos(8), reduced = false, geo: LaneGeometry = GEO): LaneEngine {
  const lane = new LaneEngine(geo, { reduced, random: () => 0.5 });
  lane.setPool(pool);
  lane.seed();
  return lane;
}

/** One print of a known shape, on the measured surface. */
function printOf(aspect: number): { lane: LaneEngine; print: Print } {
  const lane = engine([{ id: 'p', src: 'blob:p', aspect }], false, MEASURED);
  return { lane, print: lane.lane[0] };
}

/** Run the loop for `ms` in 16ms frames. */
function run(lane: LaneEngine, ms: number, from = 0): void {
  for (let t = 0; t < ms; t += 16) lane.step(16, from + t);
}

describe('lane geometry', () => {
  it('sizes the lane’s landmarks in proportion to the surface', () => {
    const small = geometryFor(390, 844);
    const large = geometryFor(780, 1688);
    expect(large.laneTop / small.laneTop).toBeCloseTo(2);
    expect(large.focal / small.focal).toBeCloseTo(2);
    expect(large.range / small.range).toBeCloseTo(2);
  });

  it('keeps the authored landmarks at the reference size', () => {
    expect(GEO.laneTop).toBeCloseTo(128, 0);
    expect(GEO.focal).toBeCloseTo(348, 0);
  });
});

describe('boxFor — a print is the shape of its own photo', () => {
  it('gives a print the aspect of the photo in it, not of the surface', () => {
    const box = boxFor(MEASURED, TALL);
    expect(box.w / box.h).toBeCloseTo(TALL, 3);
    // The defect: the box used to take the surface's own shape instead.
    expect(box.w / box.h).not.toBeCloseTo(MEASURED.w / MEASURED.h, 2);
  });

  it('gives a landscape photo a box wider than it is tall', () => {
    const box = boxFor(MEASURED, WIDE);
    expect(box.w / box.h).toBeCloseTo(WIDE, 3);
    expect(box.w).toBeGreaterThan(box.h);
  });

  it('keeps every shape inside the surface, in both directions', () => {
    for (const aspect of [0.4, TALL, 0.75, 1, 1.333, WIDE, 2]) {
      const box = boxFor(MEASURED, aspect);
      expect(box.w).toBeLessThanOrEqual(MEASURED.w);
      expect(box.h).toBeLessThanOrEqual(MEASURED.h);
      // …and is never so small that the print stops being the subject.
      expect(box.w).toBeGreaterThan(MEASURED.w * 0.3);
      expect(box.h).toBeGreaterThan(MEASURED.h * 0.2);
    }
  });

  it('falls back to a phone photo’s shape while the aspect is unknown', () => {
    expect(boxFor(MEASURED)).toEqual(boxFor(MEASURED, DEFAULT_ASPECT));
  });

  it('scales with the surface', () => {
    const small = boxFor(geometryFor(390, 844), TALL);
    const large = boxFor(geometryFor(780, 1688), TALL);
    expect(large.w / small.w).toBeCloseTo(2);
    expect(large.h / small.h).toBeCloseTo(2);
  });

  it('ignores an aspect that is not a usable number', () => {
    expect(boxFor(MEASURED, 0)).toEqual(boxFor(MEASURED, DEFAULT_ASPECT));
    expect(boxFor(MEASURED, Number.NaN)).toEqual(boxFor(MEASURED, DEFAULT_ASPECT));
  });
});

describe('openFor', () => {
  it('opens a print until it covers the whole surface', () => {
    for (const aspect of [TALL, WIDE]) {
      const box = boxFor(MEASURED, aspect);
      const open = openFor(box, MEASURED);
      expect(box.w * open).toBeGreaterThanOrEqual(MEASURED.w - 0.01);
      expect(box.h * open).toBeGreaterThanOrEqual(MEASURED.h - 0.01);
    }
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

describe('LaneEngine — each print keeps its own photo’s shape', () => {
  it('deals every photo into a box of that photo’s own aspect', () => {
    const lane = engine(
      [
        { id: 'tall', src: 'blob:1', aspect: TALL },
        { id: 'wide', src: 'blob:2', aspect: WIDE },
      ],
      false,
      MEASURED,
    );
    const [tall, wide] = lane.prints;

    expect(tall.w / tall.h).toBeCloseTo(TALL, 3);
    expect(wide.w / wide.h).toBeCloseTo(WIDE, 3);
    expect(wide.w).toBeGreaterThan(tall.w);
    expect(wide.h).toBeLessThan(tall.h);
  });

  it('deals a print at a size it will not have to change afterwards', () => {
    const { lane, print } = printOf(WIDE);
    const { w, h } = print;
    run(lane, 2000, 0);
    expect(print.w).toBe(w);
    expect(print.h).toBe(h);
  });

  it('re-derives each print’s box from its own photo when the surface resizes', () => {
    const lane = engine(
      [
        { id: 'tall', src: 'blob:1', aspect: TALL },
        { id: 'wide', src: 'blob:2', aspect: WIDE },
      ],
      false,
      MEASURED,
    );

    lane.resize(geometryFor(812, 1504));

    const [tall, wide] = lane.prints;
    expect(tall.w / tall.h).toBeCloseTo(TALL, 3);
    expect(wide.w / wide.h).toBeCloseTo(WIDE, 3);
    expect(tall.w).toBeCloseTo(boxFor(geometryFor(812, 1504), TALL).w, 3);
  });

  it('deals a print in from below the surface by its own height, whatever its shape', () => {
    for (const aspect of [TALL, WIDE]) {
      const lane = new LaneEngine(MEASURED, { random: () => 0.5 });
      lane.setPool([{ id: 'p', src: 'blob:p', aspect }]);
      const print = lane.deal();
      expect(print).not.toBeNull();
      if (!print) return;
      expect(print.y - (print.h * print.scale) / 2).toBeGreaterThanOrEqual(MEASURED.h);
    }
  });
});

describe('LaneEngine — how big each state reads', () => {
  it('gives a drifting print most of the surface width', () => {
    for (const aspect of [TALL, 0.75, 1, WIDE]) {
      const { lane, print } = printOf(aspect);
      print.y = MEASURED.focal;
      lane.paint(print);

      const share = (print.w * print.scale) / MEASURED.w;
      expect(share).toBeGreaterThanOrEqual(0.7);
      expect(share).toBeLessThanOrEqual(0.8);
    }
  });

  it('keeps a held print clearly larger than a drifting one, and both piles small', () => {
    const lane = engine(photos(4), false, MEASURED);
    const [drifting, caught, kept, gone] = lane.lane;
    drifting.y = MEASURED.focal;
    lane.paint(drifting);
    lane.hold(caught);
    lane.toKept(kept);
    lane.toSeen(gone);

    expect(caught.scale).toBeGreaterThan(drifting.scale);
    expect(drifting.scale).toBeGreaterThan(kept.scale);
    expect(kept.scale).toBeGreaterThan(gone.scale);
    // Size is how this screen says what state a print is in — the catch has to
    // be a step up, and the piles a step down, not a nudge either way.
    expect(caught.scale / drifting.scale).toBeGreaterThan(1.25);
    expect(kept.scale / drifting.scale).toBeLessThan(0.4);
  });

  it('keeps a held print inside the surface, whatever shape it is', () => {
    for (const aspect of [0.4, TALL, 1, WIDE]) {
      const { lane, print } = printOf(aspect);
      lane.hold(print);
      expect(print.y - (print.h * print.scale) / 2).toBeGreaterThanOrEqual(0);
      expect(print.y + (print.h * print.scale) / 2).toBeLessThanOrEqual(MEASURED.h);
      expect(print.w * print.scale).toBeLessThanOrEqual(MEASURED.w);
    }
  });

  it('draws the held print above the piles it is lifted clear of', () => {
    const lane = engine(photos(4), false, MEASURED);
    const [caught, kept] = lane.lane;
    lane.toKept(kept);
    lane.hold(caught);
    expect(caught.z).toBeGreaterThan(kept.z);
  });

  it('keeps the kept pile inside the bottom of the surface', () => {
    const lane = engine(photos(4), false, MEASURED);
    for (const print of [...lane.lane]) lane.toKept(print);
    for (const print of lane.kept) {
      expect(print.y + (print.h * print.scale) / 2).toBeLessThanOrEqual(MEASURED.h);
    }
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

describe('LaneEngine — shedding the depth blur on a slow device', () => {
  it('stops asking for blur once it has been lightened', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.y = GEO.focal + GEO.range;
    lane.paint(print);
    expect(print.blur).toBeGreaterThan(0);

    lane.lighten();

    expect(lane.isLightened).toBe(true);
    expect(print.blur).toBe(0);
  });

  it('keeps reading depth from scale and opacity, which cost nothing', () => {
    const lane = engine();
    lane.lighten();
    const [near, far] = lane.lane;
    near.y = GEO.focal;
    far.y = GEO.focal + GEO.range;
    lane.paint(near);
    lane.paint(far);

    expect(far.scale).toBeLessThan(near.scale);
    expect(far.opacity).toBeLessThan(near.opacity);
  });

  it('never asks for blur again, however far the focus is pulled', () => {
    const lane = engine();
    lane.lighten();
    lane.focusTarget = 1;
    run(lane, 600, 0);
    expect(lane.lane.every((print) => print.blur === 0)).toBe(true);
  });
});

describe('filterFor', () => {
  it('steps the blur so the compositor can reuse what it drew', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.blur = 2.34;
    const a = filterFor(print);
    print.blur = 2.41;
    expect(filterFor(print)).toBe(a);
  });

  it('drops a blur too small to see rather than paying for it', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.blur = 0.2;
    print.wash = '';
    expect(filterFor(print)).toBe('none');
  });
});

describe('LaneEngine — reduced motion still moves through the photos', () => {
  it('stacks every print on the focal point rather than up the lane', () => {
    const lane = engine(photos(8), true);
    expect(new Set(lane.lane.map((print) => print.y))).toEqual(new Set([GEO.focal]));
  });

  it('shows one print at a time', () => {
    const lane = engine(photos(8), true);
    const [front, ...behind] = lane.lane;
    expect(front.opacity).toBe(1);
    expect(behind.every((print) => print.opacity === 0)).toBe(true);
  });

  it('retires the front print on a beat, so the screen is never still', () => {
    const lane = engine(photos(8), true);
    const front = lane.lane[0];

    run(lane, REDUCED_HOLD_MS + 100, 0);

    expect(front.pile).toBe('seen');
    expect(lane.seenCount).toBe(1);
    expect(lane.lane[0].opacity).toBe(1);
  });

  it('keeps working through the pool beat after beat', () => {
    const lane = engine(photos(8), true);
    run(lane, REDUCED_HOLD_MS * 3 + 100, 0);
    expect(lane.seenCount).toBe(3);
    expect(lane.lane.length).toBe(KEEP_IN_LANE);
  });

  it('holds the last print rather than emptying the screen', () => {
    const lane = engine(photos(2), true);
    run(lane, REDUCED_HOLD_MS * 6, 0);
    expect(lane.lane.length).toBeGreaterThanOrEqual(1);
  });
});

describe('LaneEngine — the surface changes size', () => {
  it('keeps every print where it was in the new surface, proportionally', () => {
    const lane = engine();
    const print = lane.lane[0];
    const before = print.y / GEO.h;

    lane.resize(geometryFor(390, 422));

    expect(print.y / 422).toBeCloseTo(before, 5);
  });

  it('refans the kept pile onto the new surface', () => {
    const lane = engine();
    lane.toKept(lane.lane[0]);
    const shorter = geometryFor(390, 422);

    lane.resize(shorter);

    expect(lane.kept[0].slot?.y).toBeLessThan(shorter.h);
    expect(lane.kept[0].slot?.y).toBeGreaterThan(shorter.h * 0.5);
  });

  it('uses the new surface for the landmarks the lane is judged against', () => {
    const lane = engine();
    const print = lane.lane[0];
    lane.resize(geometryFor(390, 422));

    print.y = geometryFor(390, 422).laneTop - 1;
    const { tucked } = lane.step(16, 0);

    expect(tucked).toContain(print);
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
  it('positions the print by the centre of its own box, with rotation and scale', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.x = 195;
    print.y = 400;
    print.rot = 0;
    print.scale = 0.5;
    // Transforms are written to sub-pixel precision, not to the last float bit.
    const px = (v: number): number => Math.round(v * 1000) / 1000;
    expect(transformFor(print)).toBe(
      `translate3d(${px(195 - print.w / 2)}px, ${px(400 - print.h / 2)}px, 0) ` +
        `rotate(0deg) scale(0.5)`,
    );
  });

  it('centres each print by its own box, not by a shared one', () => {
    const lane = engine(
      [
        { id: 'tall', src: 'blob:1', aspect: TALL },
        { id: 'wide', src: 'blob:2', aspect: WIDE },
      ],
      false,
      MEASURED,
    );
    const [tall, wide] = lane.prints;
    tall.x = wide.x = MEASURED.w / 2;
    tall.y = wide.y = MEASURED.focal;
    tall.rot = wide.rot = 0;
    tall.scale = wide.scale = 0.5;

    // Same place, same scale, same rotation — only the box differs, and that is
    // enough to put them in different spots on the surface.
    expect(transformFor(tall)).not.toBe(transformFor(wide));
  });

  it('carries the sway as a sideways offset', () => {
    const lane = engine();
    const print = lane.lane[0];
    print.x = 195;
    expect(transformFor(print, 12)).toBe(transform(print, 207, print.y, print.rot, print.scale));
  });
});
