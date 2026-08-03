import type { Layout } from '@auto-stories/api-types';

/** Everything the critique pass needs about the frame it is reviewing. */
export interface CritiqueInput {
  readonly story: string;
  readonly caption: string;
  readonly atmosphere?: string;
  /** The layout the first pass proposed, for the critic to improve. */
  readonly proposed: Layout;
}

/**
 * Builds the self-critique brief (decision 7.21): the model, looking at the photo
 * again, judges the proposed layout against the bar and returns an improved one
 * (or the same if it is already strong). This is the reliability lever that turns
 * "good sometimes" into "good every time" — one revision, no loop.
 *
 * Pure and unit-tested; the model call is not. Off by default (LAYOUT_CRITIQUE_
 * ENABLED). Like the first-pass brief, its wording needs live tuning.
 */
export function buildCritiquePrompt(input: CritiqueInput): string {
  const { story, caption, atmosphere, proposed } = input;
  const atmosphereLine = atmosphere
    ? `- The atmosphere is "${atmosphere}".`
    : '';

  return [
    'You are the art director reviewing a proposed typographic layout for one frame of a personal photo story, with the photo in front of you.',
    `The story: "${story}". This frame: "${caption}".`,
    '',
    'Here is the proposed layout:',
    JSON.stringify(proposed),
    '',
    'Improve it, or return it unchanged if it is already excellent. Judge it hard against this bar:',
    '- Does it look designer-made and personal, not generic or template-like? If it feels safe or stocky, make it braver.',
    "- Is the type in the photo's NEGATIVE SPACE, off faces and the subject? Move anything sitting on a face or a busy area.",
    '- Real hierarchy and scale contrast? One element should lead; the rest stay quiet.',
    '- FIRST-PERSON, specific, imperfect voice? Rewrite anything generic or caption-like.',
    '- At most ONE handwritten (caveat) element; everything fully inside the safe area (x and y roughly 6–94).',
    atmosphereLine,
    '- Do NOT choose colour — the app computes legibility.',
    '',
    'Return the improved `elements` (or the same elements if it is already excellent).',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
