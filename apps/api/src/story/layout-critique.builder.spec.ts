import type { Layout } from '@auto-stories/api-types';

import {
  buildCritiquePrompt,
  type CritiqueInput,
} from './layout-critique.builder';

const proposed: Layout = {
  elements: [
    {
      role: 'title',
      text: 'Golden hour',
      font: 'playfair',
      weight: 'bold',
      case: 'normal',
      align: 'left',
      size: 4,
      tracking: 'wide',
      leading: 'tight',
      x: 8,
      y: 12,
      anchor: 'top-left',
    },
  ],
};

function input(over: Partial<CritiqueInput> = {}): CritiqueInput {
  return {
    story: 'a road trip',
    caption: 'we drove till it ran out',
    proposed,
    ...over,
  };
}

describe('buildCritiquePrompt', () => {
  it('includes the proposed layout and the frame context', () => {
    const prompt = buildCritiquePrompt(input());
    expect(prompt).toContain('a road trip');
    expect(prompt).toContain('we drove till it ran out');
    // The proposed layout is embedded so the critic can improve it.
    expect(prompt).toContain('Golden hour');
    expect(prompt).toContain('"anchor":"top-left"');
  });

  it('asks the model to improve or keep it, against the design bar', () => {
    const prompt = buildCritiquePrompt(input()).toLowerCase();
    expect(prompt).toMatch(/improve it|unchanged/);
    expect(prompt).toContain('negative space');
    expect(prompt).toContain('first-person');
    expect(prompt).toContain('safe area');
    expect(prompt).toMatch(/do not choose colour|app computes/);
  });

  it('mentions a given atmosphere', () => {
    expect(buildCritiquePrompt(input({ atmosphere: 'tender' }))).toContain(
      '"tender"',
    );
  });
});
