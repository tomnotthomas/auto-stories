import { LOOKS } from './caption-style';
import { buildPrompt } from './prompt.builder';

describe('buildPrompt', () => {
  const story = "Maya's 1st birthday at the lake house, all the cousins came";

  it('grounds the prompt in the user story line', () => {
    expect(buildPrompt(story)).toContain(story);
  });

  it('names the requested tone when one is given', () => {
    expect(buildPrompt(story, 'heartfelt')).toMatch(/heartfelt/i);
  });

  it('omits tone guidance when none is given', () => {
    // Not a bare /tone/ — `duotone-band` is a Look id, and matching on the
    // substring would fail for a word that has nothing to do with tone.
    expect(buildPrompt(story)).not.toMatch(/match this tone/i);
  });

  it('instructs narrative ordering (hook first, payoff last)', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toContain('hook');
    expect(prompt).toContain('order');
  });

  it('targets a 5–7 frame story so it is not cut too short', () => {
    const prompt = buildPrompt(story);
    expect(prompt).toContain('5');
    expect(prompt).toContain('7');
    expect(prompt.toLowerCase()).toContain('frame');
  });

  it('invites optional, accurate Instagram add-on suggestions', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toContain('suggestions');
    expect(prompt).toMatch(/location|gif|poll|music/);
  });

  // Decision 7.26: the model picks how much the photo needs from a fixed
  // vocabulary, instead of guessing an amount the design never asked for. The
  // old "vary the headline length" wording said the same thing vaguely and is
  // replaced by the five rungs below.
  it('asks for a density per frame and names all five rungs', () => {
    const prompt = buildPrompt(story);
    expect(prompt).toContain('`density`');
    for (const rung of ['silent', 'beat', 'line', 'thought', 'question']) {
      expect(prompt).toContain(`\`${rung}\``);
    }
  });

  it('gives each rung an amount of text, so the rungs are distinguishable', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toMatch(/1 to 3 words/);
    expect(prompt).toMatch(/4 to 12 words/);
    expect(prompt).toMatch(/15 to 35 words|2 to 3 lines/);
  });

  // The first failure mode: a model that treats an empty headline as a mistake
  // captions every frame, and the story reads as relentless.
  it('makes clear that silent is a correct choice, not a failure', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toMatch(/no text at all|no words at all/);
    expect(prompt).toMatch(/not a failure|real, correct choice/);
    expect(prompt).toMatch(/relentless|every frame is captioned/);
  });

  // The second: `thought` and `line` collapse into each other unless the
  // prompt says outright that a thought is more text.
  it('separates thought from line by making thought deliberately longer', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toMatch(/more text than a `line`|deliberately more text/);
  });

  // The third: a uniform row of same-length labels.
  it('asks for rhythm across the story, never a uniform row of labels', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toContain('rhythm');
    expect(prompt).toMatch(/never a uniform/);
  });

  it('ties the headline to the density the model chose', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toMatch(/write the `headline` to the density/);
    expect(prompt).toMatch(/must agree/);
    expect(prompt).toContain('headline');
  });

  it('tells the model not to overload a photo with competing elements', () => {
    expect(buildPrompt(story).toLowerCase()).toMatch(/overload|competes/);
  });

  // Decision 7.25 / 7.24: one text per frame, and the Look owns all of its type.
  it('offers every Look the contract allows', () => {
    // The range only exists if the model can name it. Six Looks were described
    // here long after thirty-two were built, so every story wore the same one.
    const prompt = buildPrompt(story);
    for (const look of LOOKS) {
      expect(prompt).toContain(`\`${look}\``);
    }
  });

  it('never asks the model for a font, a letterbox or extra text blocks', () => {
    const prompt = buildPrompt(story).toLowerCase();
    // `letterbox` is a Look id now, so the old bare substring check fired on the
    // Look list. What must stay gone is the model *choosing* type or fill.
    for (const banned of [
      '`texts`',
      'font (',
      'letterbox (',
      'playfair',
      'space-mono',
      'caveat',
    ]) {
      expect(prompt).not.toContain(banned);
    }
  });

  // Decision 7.25: nothing on the frame is placed by the model any more — not
  // the words, and no longer the add-ons. The only line that may say "position"
  // is the one forbidding it.
  it('never asks for a position, on the words or on an add-on', () => {
    const positioned = buildPrompt(story)
      .toLowerCase()
      .split('\n')
      .filter((line) => line.includes('position'));
    const asked = positioned.filter((line) => !line.includes('do not choose'));
    expect(asked).toEqual([]);
  });

  it('tells the model the app places add-ons and drops ones that do not fit', () => {
    const bullet = buildPrompt(story)
      .split('\n')
      .find((line) => line.includes('`suggestions`'));
    expect(bullet).toBeDefined();
    const lower = (bullet ?? '').toLowerCase();
    expect(lower).toMatch(/the app decides where/);
    expect(lower).toMatch(/no room|does not fit|drops/);
    // The model's job on an add-on is now only whether, and how sure.
    expect(lower).toContain('confidence');
  });

  it('offers every add-on type, not location first', () => {
    const bullet =
      buildPrompt(story)
        .split('\n')
        .find((line) => line.includes('`suggestions`')) ?? '';
    for (const type of ['location', 'mention', 'gif', 'poll', 'music']) {
      expect(bullet).toContain(type);
    }
  });

  it('keeps distinct moments and only drops weak or duplicate photos', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toContain('distinct');
    expect(prompt).toMatch(/duplicate|blurr|redundant/);
  });

  it('asks for the frames shape the schema enforces', () => {
    const prompt = buildPrompt(story);
    expect(prompt).toContain('photoId');
    expect(prompt).toContain('look');
    expect(prompt).toContain('headline');
    expect(prompt).toContain('order');
  });

  it('names all six Looks so the choice is informed', () => {
    const prompt = buildPrompt(story);
    for (const look of [
      'quiet-editorial',
      'film-postcard',
      'bold-poster',
      'scrapbook',
      'minimal',
      'magazine-masthead',
    ]) {
      expect(prompt).toContain(look);
    }
  });

  // Decision 7.26, the half the rungs on their own cannot state. The model picks
  // the `look` and writes the words in the SAME call, so a design that cannot
  // hold 35 words has to be told so here — the client's own budget is published
  // after the words are already written, which is too late to change them.
  describe('what the chosen design can hold', () => {
    /** The one bullet that states the loud family's smaller budget. */
    const budgetLine = (): string =>
      buildPrompt(story)
        .split('\n')
        .find(
          (line) => line.includes('LOUD') && line.includes('fewer words'),
        ) ?? '';

    it('states the budget by family, for every loud look', () => {
      // Stated by family on purpose: 32 Looks × 5 rungs is a table no prompt
      // should carry, and the loud/quiet split is what moves the number.
      const bullet = budgetLine();
      expect(bullet).not.toBe('');
      for (const look of [
        'bold-poster',
        'split-block',
        'ticker',
        'stencil-caps',
        'zine',
        'duotone-band',
      ]) {
        expect(bullet).toContain(`\`${look}\``);
      }
    });

    it('gives the loud family a thought budget well under the rung ceiling', () => {
      const bullet = budgetLine();
      const stated = /about (\d+) words/.exec(bullet);

      expect(stated).not.toBeNull();
      // The rung itself allows 15–35; a loud look takes the short end.
      expect(Number(stated?.[1])).toBeLessThan(35);
      expect(bullet.toLowerCase()).toMatch(/never 35|not 35/);
    });

    it('leaves the quieter families carrying a full thought', () => {
      const bullet = budgetLine();

      expect(bullet).toContain('QUIET, EDITORIAL and WARM');
      expect(bullet.toLowerCase()).toMatch(/carry a full `thought`/);
    });

    it('makes the chosen design decide how much text it can hold', () => {
      const prompt = buildPrompt(story).toLowerCase();

      expect(prompt).toMatch(/design you choose decides how much text/);
      expect(prompt).toMatch(/match the words to it/);
    });

    it('names loud-look-plus-long-thought as the mistake to avoid', () => {
      // The specific failure: the model reaches for a poster and then writes a
      // paragraph into it, and each half looks defensible on its own.
      expect(buildPrompt(story).toLowerCase()).toMatch(
        /choosing a loud look and then writing a long thought/,
      );
    });
  });

  it('asks for exactly one Look, held across every frame', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toMatch(/exactly one|one look/);
    expect(prompt).toContain('every frame');
  });

  it('asks for a headline plus an optional kicker and emphasis', () => {
    const prompt = buildPrompt(story);
    expect(prompt).toContain('kicker');
    expect(prompt).toContain('emphasis');
    // The marked phrase has to be findable in the headline or the mark is lost.
    expect(prompt.toLowerCase()).toContain('verbatim');
  });

  // Ported from the deleted layout-prompt builder: the user-set atmosphere now
  // steers the Look choice instead of per-frame geometry.
  it('honours a given atmosphere, else asks the model to infer it', () => {
    expect(buildPrompt(story, undefined, undefined, 'tender')).toContain(
      '"tender"',
    );
    expect(buildPrompt(story).toLowerCase()).toContain('read the atmosphere');
  });

  it('points the given atmosphere at the look choice', () => {
    const prompt = buildPrompt(story, undefined, undefined, 'tender');
    expect(prompt).toContain('look');
    expect(prompt.toLowerCase()).toContain('atmosphere');
  });

  it('forbids the model from choosing any geometry (decision 7.24)', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toMatch(/do not choose|never choose/);
    expect(prompt).toMatch(/coordinates/);
  });

  it('treats capture time as a soft hint only', () => {
    expect(buildPrompt(story).toLowerCase()).toContain('timestamp');
  });

  it('forces the model to include and caption a hand-added photo', () => {
    const prompt = buildPrompt(story, undefined, ['p7']);
    expect(prompt).toContain('p7');
    expect(prompt.toLowerCase()).toContain('must include');
  });

  it('omits the must-include instruction when none are given', () => {
    expect(buildPrompt(story).toLowerCase()).not.toContain('must include');
    expect(buildPrompt(story, undefined, []).toLowerCase()).not.toContain(
      'must include',
    );
  });
});
