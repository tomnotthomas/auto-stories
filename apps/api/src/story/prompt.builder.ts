import type { Tone } from '@auto-stories/api-types';

/**
 * Builds the instruction sent to the model alongside the photos. Pure and
 * deterministic so it can be unit-tested; the model call itself is not.
 *
 * The rules mirror docs/phase-1/architecture.md: order by the story line and
 * what's visible (strongest hook first → payoff), use capture time only as a
 * soft hint, and write specific, grounded captions in the requested tone.
 */
export function buildPrompt(story: string, tone?: Tone): string {
  const toneLine = tone
    ? `\n- Match this tone: ${tone}. Let it color word choice, not the facts.`
    : '';

  return [
    'You arrange a batch of photos into a short, coherent Instagram Story.',
    'Each image is provided in the same order as the photos array; the caption text before each image is its photoId.',
    '',
    `The story, in the user's words: "${story}"`,
    '',
    'Do this:',
    '- Choose which photos to use and put them in narrative order: strongest visual + story hook first, then build, then the payoff last.',
    '- Order by the story line and what is actually visible in each photo, NOT by the capture timestamp (treat any timestamp as a soft hint only).',
    '- Write one caption per chosen photo. Ground it in the specifics the user gave (names, occasion, place) and in what the photo shows, so it feels true rather than generic.',
    toneLine,
    '',
    'Return only the chosen photos, each as a frame with its photoId, its 1-based order, and its caption.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
