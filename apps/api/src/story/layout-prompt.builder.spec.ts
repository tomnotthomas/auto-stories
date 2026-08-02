import {
  buildLayoutPrompt,
  type LayoutBriefInput,
} from './layout-prompt.builder';

function input(over: Partial<LayoutBriefInput> = {}): LayoutBriefInput {
  return {
    story: "Maya's 1st birthday at the lake",
    caption: 'she blew out the candle',
    frameNo: 2,
    frameCount: 6,
    ...over,
  };
}

describe('buildLayoutPrompt', () => {
  it('grounds the brief in the story and this frame', () => {
    const prompt = buildLayoutPrompt(input());
    expect(prompt).toContain("Maya's 1st birthday at the lake");
    expect(prompt).toContain('she blew out the candle');
    expect(prompt).toContain('frame 2 of 6');
  });

  it('describes the layout vocabulary (roles, faces, size ramp, anchor)', () => {
    const prompt = buildLayoutPrompt(input()).toLowerCase();
    expect(prompt).toMatch(/label.*title.*deck|role/);
    expect(prompt).toContain('caveat');
    expect(prompt).toContain('negative space');
    expect(prompt).toMatch(/anchor/);
  });

  it('encodes the personal, restrained design law', () => {
    const prompt = buildLayoutPrompt(input()).toLowerCase();
    expect(prompt).toContain('first-person');
    expect(prompt).toMatch(/one handwritten|at most one/);
    expect(prompt).toContain('safe margin');
    // Colour/scrim is the app's job, not the model's (7.10).
    expect(prompt).toMatch(/do not choose colour|app computes/);
  });

  it('honours a given atmosphere, else asks the model to infer it', () => {
    expect(buildLayoutPrompt(input({ atmosphere: 'tender' }))).toContain(
      '"tender"',
    );
    expect(
      buildLayoutPrompt(input({ atmosphere: undefined })).toLowerCase(),
    ).toContain('read the atmosphere');
  });

  it('tells the model to avoid the recent frames’ lead anchors (no repeat)', () => {
    const prompt = buildLayoutPrompt(
      input({ avoidAnchors: ['top-left', 'bottom'] }),
    );
    expect(prompt).toContain('top-left');
    expect(prompt).toContain('bottom');
    expect(prompt.toLowerCase()).toMatch(/differently|no two frames/);
  });

  it('names the requested tone when one is given', () => {
    expect(buildLayoutPrompt(input({ tone: 'heartfelt' }))).toMatch(
      /heartfelt/i,
    );
  });
});
