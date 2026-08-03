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
    expect(buildPrompt(story)).not.toMatch(/tone/i);
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

  it('tells the model to vary headline length per photo, not a uniform terseness', () => {
    const prompt = buildPrompt(story).toLowerCase();
    // A self-explanatory photo still breathes…
    expect(prompt).toContain('breathe');
    expect(prompt).toContain('vary');
    // …but a frame that needs context earns a fuller line.
    expect(prompt).toMatch(/fuller line|short sentence/);
    // The headlines across the story should have rhythm, not the same few words.
    expect(prompt).toMatch(/rhythm|never a uniform/);
    // The judgement is about the headline now — there is no second text field.
    expect(prompt).toContain('headline');
  });

  it('tells the model not to overload a photo with competing elements', () => {
    expect(buildPrompt(story).toLowerCase()).toMatch(/overload|competes/);
  });

  // Decision 7.25 / 7.24: one text per frame, and the Look owns all of its type.
  it('never asks the model for a font, a letterbox or extra text blocks', () => {
    const prompt = buildPrompt(story).toLowerCase();
    for (const banned of [
      'texts',
      'font',
      'letterbox',
      'playfair',
      'space-mono',
      'caveat',
    ]) {
      expect(prompt).not.toContain(banned);
    }
  });

  // Suggestions still carry an anchor zone; the frame's own text never does, so
  // the only other line allowed to say "position" is the one forbidding it.
  it('only ever asks for a position on a suggestion, never on the words', () => {
    const positioned = buildPrompt(story)
      .toLowerCase()
      .split('\n')
      .filter((line) => line.includes('position'));
    const asked = positioned.filter((line) => !line.includes('do not choose'));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('suggestions');
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
