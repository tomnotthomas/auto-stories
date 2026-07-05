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

  it('keeps distinct moments and only drops weak or duplicate photos', () => {
    const prompt = buildPrompt(story).toLowerCase();
    expect(prompt).toContain('distinct');
    expect(prompt).toMatch(/duplicate|blurr|redundant/);
  });

  it('asks for the frames shape the schema enforces', () => {
    const prompt = buildPrompt(story);
    expect(prompt).toContain('photoId');
    expect(prompt).toContain('caption');
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
    expect(buildPrompt(story, undefined, []).toLowerCase()).not.toContain('must include');
  });
});
