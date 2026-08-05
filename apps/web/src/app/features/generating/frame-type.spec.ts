import type { Frame } from '@auto-stories/api-types';

import { kickerFor, paceFor, splitHeadlineLines, revealDuration, typeFor } from './frame-type';

function frame(headline: string, extra: Partial<Frame> = {}): Frame {
  return { photoId: 'p1', order: 1, headline, ...extra };
}

describe('splitHeadlineLines', () => {
  it('keeps a short headline on one line', () => {
    expect(splitHeadlineLines('The audit')).toEqual([['The', 'audit']]);
  });

  it('breaks a longer headline into two balanced lines', () => {
    expect(splitHeadlineLines('It started with a mirror and a plan')).toEqual([
      ['It', 'started', 'with', 'a'],
      ['mirror', 'and', 'a', 'plan'],
    ]);
  });

  it('never loses or reorders a word', () => {
    const headline = 'Home sticky and completely victorious after a very long night';
    expect(splitHeadlineLines(headline).flat().join(' ')).toBe(headline);
  });

  it('collapses stray whitespace and ignores a silent frame', () => {
    expect(splitHeadlineLines('  one   two  ')).toEqual([['one', 'two']]);
    expect(splitHeadlineLines('   ')).toEqual([]);
  });
});

describe('kickerFor', () => {
  it('says the user called it when the model agrees with their pick', () => {
    expect(kickerFor(frame('x', { kicker: 'saturday' }), 6, true)).toBe('you called it');
  });

  it('uses the model’s own kicker when it wrote one', () => {
    expect(kickerFor(frame('x', { order: 3, kicker: 'saturday' }), 6, false)).toBe('saturday');
  });

  it('falls back to the frame’s place in the story — never an invented reason', () => {
    expect(kickerFor(frame('x', { order: 1 }), 6, false)).toBe('opens the story');
    expect(kickerFor(frame('x', { order: 6 }), 6, false)).toBe('closes it');
    expect(kickerFor(frame('x', { order: 3 }), 6, false)).toBe('next beat');
    expect(kickerFor(frame('x', { order: 1 }), 1, false)).toBe('opens the story');
  });

  it('never claims a frame closes a story whose length it does not know yet', () => {
    // While the model is still writing, the frame in hand may or may not be the
    // last one — so only the opener is safe to name.
    expect(kickerFor(frame('x', { order: 1 }), null, false)).toBe('opens the story');
    expect(kickerFor(frame('x', { order: 4 }), null, false)).toBe('next beat');
  });
});

describe('typeFor', () => {
  it('sets the words at the end the story’s Look will anchor them to', () => {
    const type = typeFor(frame('Out before the light went'), 6, false, 'magazine-masthead');
    expect(['top', 'bottom']).toContain(type.position);
  });

  it('numbers the words across the whole headline so they land one at a time', () => {
    const type = typeFor(frame('It started with a mirror and a plan'), 6, false);
    expect(type.lines.map((line) => line.startIndex)).toEqual([0, 4]);
    expect(type.wordCount).toBe(8);
  });

  it('carries the kicker and the agreement flag', () => {
    const type = typeFor(frame('The audit', { order: 6 }), 6, true);
    expect(type.kicker).toBe('you called it');
    expect(type.agreed).toBe(true);
  });

  it('keeps a silent frame silent — no words, and nothing to reveal', () => {
    const type = typeFor(frame('', { density: 'silent' }), 6, false);
    expect(type.wordCount).toBe(0);
    expect(type.silent).toBe(true);
  });

  it('is not silent when the model wrote words', () => {
    expect(typeFor(frame('The audit'), 6, false).silent).toBe(false);
  });
});

describe('paceFor', () => {
  it('runs at full speed when there is time for everything', () => {
    expect(paceFor(1, 6000, 5000)).toBe(1);
  });

  it('speeds up in proportion to how many choices are waiting', () => {
    expect(paceFor(2, 6000, 3000)).toBeCloseTo(1);
    expect(paceFor(3, 6000, 4000)).toBeCloseTo(2);
  });

  it('never speeds up past the point where the beats stop reading', () => {
    expect(paceFor(20, 6000, 5000)).toBe(4);
  });

  it('is a no-op when nothing is waiting', () => {
    expect(paceFor(0, 6000, 5000)).toBe(1);
  });
});

describe('revealDuration', () => {
  it('spends about 2.4s on a typical headline, beats end to end', () => {
    const type = typeFor(frame('It started with a mirror and a plan'), 6, false);
    const ms = revealDuration(type, false);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(2800);
  });

  it('is shorter for a shorter headline', () => {
    const short = typeFor(frame('The audit'), 6, false);
    const long = typeFor(frame('It started with a mirror and a plan'), 6, false);
    expect(revealDuration(short, false)).toBeLessThan(revealDuration(long, false));
  });

  it('stays a reveal under reduced motion, just a quicker one', () => {
    const type = typeFor(frame('It started with a mirror and a plan'), 6, false);
    expect(revealDuration(type, true)).toBeGreaterThan(0);
    expect(revealDuration(type, true)).toBeLessThan(revealDuration(type, false));
  });

  it('takes proportionally less time at a quicker pace, beat for beat', () => {
    const type = typeFor(frame('It started with a mirror and a plan'), 6, false);
    const full = revealDuration(type, false);
    const quick = revealDuration(type, false, 4);
    expect(quick).toBeLessThan(full / 3);
    expect(quick).toBeGreaterThan(0);
  });

  it('costs only the stillness on a silent frame', () => {
    const type = typeFor(frame('', { density: 'silent' }), 6, false);
    expect(revealDuration(type, false)).toBeLessThan(500);
  });
});
