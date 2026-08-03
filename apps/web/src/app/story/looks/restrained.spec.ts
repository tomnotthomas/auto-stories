import { DEFAULT_ACCENT } from '../accent-color';
import type { Composition, FrameContent, Look, PhotoAnalysis, TextPart } from '../look';
import { textParts } from '../look';
import type { BandScores } from '../quiet-zone';
import { CORNER_NOTE } from './corner-note';
import { FOOTER_RULE } from './footer-rule';
import { GALLERY_LABEL } from './gallery-label';
import { MINIMAL } from './minimal';
import { QUIET_EDITORIAL } from './quiet-editorial';

/**
 * The restrained group (catalogue section A): the photo dominates and the type
 * is quiet but still designed. These are the Looks a story falls to when it
 * shouldn't shout, so the shared contract below — composes something, composes
 * *nothing* when silent, never throws on missing words or a busy photo, stays
 * inside the frame — matters more here than any single Look's own signature.
 */

const PHOTO: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

/** Nowhere is quiet — every Look has to place its type anyway. */
const BUSY: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.97, middle: 0.98, bottom: 0.99 },
};

const CONTENT: FrameContent = {
  kicker: 'The Ascent',
  headline: 'Where the mountain meets its mirror',
  emphasis: 'mountain',
  location: 'Lofoten, Norway',
};

const RESTRAINED: readonly Look[] = [
  QUIET_EDITORIAL,
  MINIMAL,
  GALLERY_LABEL,
  CORNER_NOTE,
  FOOTER_RULE,
];

describe.each(RESTRAINED.map((look) => [look.id, look] as const))('%s', (id, look) => {
  it('is registered under its own id', () => {
    expect(look.id).toBe(id);
  });

  it('names the bands it wants, best first', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('composes something for a normal frame', () => {
    const composition = look.compose(CONTENT, PHOTO);

    expect(composition.lookId).toBe(id);
    expect(composition.parts.length).toBeGreaterThan(0);
  });

  it('always sets the headline somewhere', () => {
    const composition = look.compose(CONTENT, PHOTO);

    expect(allText(composition)).toContain(CONTENT.headline);
  });

  it('composes to nothing at all when the frame is silent', () => {
    // No words is a real choice (7.26): everything these Looks draw exists to
    // frame the words, so with none there is nothing to frame.
    for (const headline of ['', '   ', '\n']) {
      const composition = look.compose({ ...CONTENT, headline }, PHOTO);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
      expect(composition.panel).toBeUndefined();
      expect(composition.border).toBeUndefined();
    }
  });

  it('composes from the headline alone', () => {
    expect(() => look.compose({ headline: 'Just this' }, PHOTO)).not.toThrow();
    expect(allText(look.compose({ headline: 'Just this' }, PHOTO))).toContain('Just this');
  });

  it('degrades rather than throwing on missing words or a busy photo', () => {
    const cases: FrameContent[] = [
      { headline: CONTENT.headline },
      { headline: CONTENT.headline, kicker: '  ' },
      { headline: CONTENT.headline, location: '   ' },
      { headline: CONTENT.headline, emphasis: 'not in the headline' },
      { kicker: CONTENT.kicker, headline: CONTENT.headline },
      { headline: 'x' },
    ];

    for (const content of cases) {
      for (const photo of [PHOTO, BUSY]) {
        expect(() => look.compose(content, photo)).not.toThrow();
        expect(look.compose(content, photo).parts.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps its type column inside the frame', () => {
    const composition = look.compose(CONTENT, PHOTO);

    expect(composition.leftPct).toBeGreaterThan(0);
    expect(composition.rightPct).toBeGreaterThan(0);
    expect(composition.leftPct + composition.rightPct).toBeLessThan(60);
    expect(composition.offsetHPct).toBeGreaterThan(0);
    expect(composition.offsetHPct).toBeLessThan(30);
  });

  it('anchors to an edge it asked for when the photo allows', () => {
    expect(look.compose(CONTENT, PHOTO).anchor).toBe(look.prefer[0]);
  });

  it('moves off its preferred band when the photo is busy there', () => {
    const preferred = look.prefer[0];
    const bands: BandScores = { top: 0.05, middle: 0.05, bottom: 0.05 };
    bands[preferred] = 0.95;

    expect(look.compose(CONTENT, { ...PHOTO, bands }).anchor).not.toBe(preferred);
  });

  it('carries the photo’s accent through', () => {
    expect(look.compose(CONTENT, { ...PHOTO, accent: 'rgb(1, 2, 3)' }).accent).toBe('rgb(1, 2, 3)');
  });

  it('states a polarity the renderer can resolve', () => {
    expect(['light', 'dark', 'auto']).toContain(look.compose(CONTENT, PHOTO).ink);
  });

  it('declares no literal colours — only ink, accent or paper', () => {
    for (const part of look.compose(CONTENT, PHOTO).parts) {
      expect(['ink', 'accent', 'paper']).toContain(part.color);
    }
  });

  it('is deterministic', () => {
    expect(look.compose(CONTENT, PHOTO)).toEqual(look.compose(CONTENT, PHOTO));
  });

  it('stays restrained: no tilt, no marks, no photo treatment', () => {
    const composition = look.compose(CONTENT, PHOTO);

    expect(composition.rotationDeg).toBeUndefined();
    expect(composition.photoFilter).toBeUndefined();
    expect(textParts(composition).some((part) => part.mark)).toBe(false);
  });
});

describe('quiet-editorial', () => {
  it('sets the headline in Fraunces at a modest size', () => {
    const headline = named(QUIET_EDITORIAL.compose(CONTENT, PHOTO), CONTENT.headline);

    expect(headline.fontFamily).toContain('Fraunces');
    expect(headline.fontWeight).toBe(400);
    expect(headline.fontSizeWPct).toBeLessThan(7);
  });

  it('holds the column off the right edge so the line never runs full width', () => {
    const composition = QUIET_EDITORIAL.compose(CONTENT, PHOTO);

    expect(composition.rightPct).toBeGreaterThan(composition.leftPct);
  });

  it('sets a letter-spaced kicker above the line', () => {
    const parts = textParts(QUIET_EDITORIAL.compose(CONTENT, PHOTO));

    expect(runText(parts[0])).toBe('The Ascent');
    expect(parts[0].letterSpacingEm).toBeGreaterThan(0.2);
  });

  it('falls back to the place when the model wrote no kicker', () => {
    const parts = textParts(
      QUIET_EDITORIAL.compose({ headline: CONTENT.headline, location: 'Lofoten' }, PHOTO),
    );

    expect(runText(parts[0])).toBe('Lofoten');
  });

  it('sets the headline alone when there is neither kicker nor place', () => {
    const parts = textParts(QUIET_EDITORIAL.compose({ headline: 'Just this' }, PHOTO));

    expect(parts).toHaveLength(1);
  });
});

describe('minimal', () => {
  it('is top-anchored, with the type high on the frame', () => {
    expect(MINIMAL.prefer[0]).toBe('top');
    expect(MINIMAL.compose(CONTENT, PHOTO).anchor).toBe('top');
  });

  it('leaves the photo unshaded and defers the polarity to the pixels', () => {
    const composition = MINIMAL.compose(CONTENT, PHOTO);

    expect(composition.scrim).toBeNull();
    expect(composition.ink).toBe('auto');
  });

  it('sets thin, light type', () => {
    const headline = named(MINIMAL.compose(CONTENT, PHOTO), CONTENT.headline);

    expect(headline.fontWeight).toBeLessThanOrEqual(300);
  });

  it('drops the kicker entirely — Minimal has no room for one', () => {
    expect(allText(MINIMAL.compose(CONTENT, PHOTO))).not.toContain('The Ascent');
  });

  it('draws a short hairline under the headline', () => {
    const rules = MINIMAL.compose(CONTENT, PHOTO).parts.filter((part) => part.kind === 'rule');

    expect(rules).toHaveLength(1);
    expect(rules[0].widthPct).toBeLessThan(30);
  });

  it('sets the place in spaced uppercase', () => {
    const place = named(MINIMAL.compose(CONTENT, PHOTO), 'Lofoten, Norway');

    expect(place.textTransform).toBe('uppercase');
    expect(place.letterSpacingEm).toBeGreaterThan(0.2);
  });

  it('drops the rule and the place when there is no place to name', () => {
    const composition = MINIMAL.compose({ headline: CONTENT.headline }, PHOTO);

    expect(composition.parts).toHaveLength(1);
  });
});

describe('gallery-label', () => {
  it('declares a paper panel — the panel is the graphic', () => {
    const composition = GALLERY_LABEL.compose(CONTENT, PHOTO);

    expect(composition.panel?.color).toBe('paper');
    expect(composition.panel?.fullWidth).toBe(false);
  });

  it('writes dark on that paper, with no scrim', () => {
    const composition = GALLERY_LABEL.compose(CONTENT, PHOTO);

    expect(composition.ink).toBe('dark');
    expect(composition.scrim).toBeNull();
  });

  it('keeps the label small — a wall label, not a masthead', () => {
    const composition = GALLERY_LABEL.compose(CONTENT, PHOTO);
    const widest = Math.max(...textParts(composition).map((part) => part.fontSizeWPct));

    // Under half the frame's width, and every line set tiny.
    expect(100 - composition.leftPct - composition.rightPct).toBeLessThan(60);
    expect(widest).toBeLessThan(4);
  });

  it('sets the title and the place inside the panel', () => {
    const text = allText(GALLERY_LABEL.compose(CONTENT, PHOTO));

    expect(text).toContain(CONTENT.headline);
    expect(text).toContain('Lofoten, Norway');
  });

  it('keeps the panel when the frame has words but no place', () => {
    const composition = GALLERY_LABEL.compose({ headline: 'Just this' }, PHOTO);

    expect(composition.panel).toBeDefined();
    expect(allText(composition)).toContain('Just this');
  });
});

describe('corner-note', () => {
  it('is one right-aligned text part and nothing else', () => {
    const composition = CORNER_NOTE.compose(CONTENT, PHOTO);

    expect(composition.parts).toHaveLength(1);
    expect(textParts(composition)).toHaveLength(1);
    expect(textParts(composition)[0].textAlign).toBe('right');
  });

  it('sits in the top corner, unshaded', () => {
    const composition = CORNER_NOTE.compose(CONTENT, PHOTO);

    expect(composition.anchor).toBe('top');
    expect(composition.scrim).toBeNull();
    expect(composition.panel).toBeUndefined();
  });

  it('sets it very small, in a mono face', () => {
    const note = textParts(CORNER_NOTE.compose(CONTENT, PHOTO))[0];

    expect(note.fontFamily).toContain('mono');
    expect(note.fontSizeWPct).toBeLessThan(3.5);
  });

  it('stays one part even with a kicker and a place to spend', () => {
    expect(CORNER_NOTE.compose(CONTENT, PHOTO).parts).toHaveLength(1);
    expect(allText(CORNER_NOTE.compose(CONTENT, PHOTO))).toBe(CONTENT.headline);
  });
});

describe('footer-rule', () => {
  it('draws one hairline across the full column with the text centred beneath', () => {
    const composition = FOOTER_RULE.compose({ headline: CONTENT.headline }, PHOTO);
    const rules = composition.parts.filter((part) => part.kind === 'rule');

    expect(rules).toHaveLength(1);
    expect(rules[0].widthPct).toBe(100);
    expect(composition.parts.indexOf(rules[0])).toBe(0);
    expect(textParts(composition).every((part) => part.textAlign === 'center')).toBe(true);
  });

  it('sets the caption in spaced uppercase, small', () => {
    const caption = named(FOOTER_RULE.compose(CONTENT, PHOTO), CONTENT.headline);

    expect(caption.textTransform).toBe('uppercase');
    expect(caption.letterSpacingEm).toBeGreaterThan(0);
    expect(caption.fontSizeWPct).toBeLessThan(4.5);
  });

  it('hangs low on the frame, edge to edge', () => {
    const composition = FOOTER_RULE.compose(CONTENT, PHOTO);

    expect(composition.anchor).toBe('bottom');
    expect(composition.leftPct).toBe(composition.rightPct);
  });

  it('puts the kicker above the rule, like a plate number', () => {
    const composition = FOOTER_RULE.compose(CONTENT, PHOTO);
    const first = composition.parts[0];

    expect(first.kind).toBe('text');
    expect(runText(first as TextPart)).toBe('The Ascent');
  });

  it('names the place under the caption when there is one', () => {
    const parts = textParts(FOOTER_RULE.compose(CONTENT, PHOTO));

    expect(runText(parts[parts.length - 1])).toBe('Lofoten, Norway');
  });
});

/** The visible text of a text part, runs joined. */
function runText(part: TextPart): string {
  return part.runs.map((run) => run.text).join('');
}

/** Every word a composition sets, joined — order preserved. */
function allText(composition: Composition): string {
  return textParts(composition).map(runText).join(' ');
}

/** The text part carrying `text`. Fails loudly rather than returning undefined. */
function named(composition: Composition, text: string): TextPart {
  const part = textParts(composition).find((candidate) => runText(candidate) === text);
  if (!part) throw new Error(`no part sets “${text}”`);
  return part;
}
