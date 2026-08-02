import type { Tone } from '@auto-stories/api-types';

/** Everything the art-direction brief needs about one frame. */
export interface LayoutBriefInput {
  /** The user's story line, for context and voice. */
  readonly story: string;
  /** The caption already written for this frame (the meaning to art-direct). */
  readonly caption: string;
  /** Optional user-set atmosphere; when absent the model infers it. */
  readonly atmosphere?: string;
  readonly tone?: Tone;
  readonly frameNo: number;
  readonly frameCount: number;
  /** Anchors the recent frames led with, so this one composes differently. */
  readonly avoidAnchors?: readonly string[];
}

/**
 * Builds the per-frame art-direction brief for the layout agent (decision 7.21).
 * Pure and deterministic so it can be unit-tested; the model call is not.
 *
 * NOTE: this is the initial brief. Its wording is the single biggest lever on
 * output quality and MUST be tuned against real photos + model output on a
 * machine with a GOOGLE_CLOUD_API_KEY — it cannot be judged from unit tests.
 */
export function buildLayoutPrompt(input: LayoutBriefInput): string {
  const {
    story,
    caption,
    atmosphere,
    tone,
    frameNo,
    frameCount,
    avoidAnchors,
  } = input;

  const atmosphereLine = atmosphere
    ? `- The atmosphere for this story is "${atmosphere}". Let it drive the face, scale, and energy.`
    : '- Read the atmosphere from the photo and the story line (heartfelt, hectic, still, triumphant, tender…) and let it drive the face, scale, and energy.';
  const toneLine = tone ? `- Match this tone: ${tone}.` : '';
  const avoidLine =
    avoidAnchors && avoidAnchors.length
      ? `- The recent frames led with type anchored at ${avoidAnchors.join(', ')}. Compose THIS frame differently — a different anchor, a different rhythm. No two frames in a story should look alike.`
      : '';

  return [
    `You are art-directing the typography for frame ${frameNo} of ${frameCount} in a personal photo story.`,
    `The story, in the user's words: "${story}".`,
    `This frame's meaning, already written: "${caption}".`,
    '',
    'Compose a small set of placed text elements so this single frame looks like a designer made it, and like it belongs to a real person — not a template, not a stock caption. Return only `elements`.',
    '',
    'Each element has: role (label, title, or deck); text; font (inter = a modern grotesque, playfair = a warm editorial serif, space-mono = a mono, caveat = real handwriting); weight; case; align; size (0 tiny … 6 masthead, a modular scale); tracking (tight/normal/wide); leading (tight/normal/loose); x and y (0–100, the anchor point as a percent of the frame); anchor (which point of the block sits on x,y, so a corner-anchored block extends inward); and stack (break the text into one word per line).',
    '',
    'Design law:',
    "- Place type in the photo's NEGATIVE SPACE, off faces and the main subject. Look at where the empty room is and put the words there.",
    '- Use real hierarchy and scale contrast: usually one element leads big, the rest stay quiet. Most frames want 1–3 elements; a whisper can be a single small line.',
    '- Rewrite the meaning in a FIRST-PERSON, specific, slightly imperfect voice ("mum cried up here", not "Zermatt"). Keep it short.',
    '- At most ONE handwritten (caveat) element, as the personal signature — a date, a name, an aside. Everything else is set type. One human gesture, not a scrapbook.',
    '- Keep every element fully inside a safe margin (x and y roughly 6–94).',
    '- Do NOT choose colour or a background — the app computes legible colour and any scrim from the photo. Compose only type and placement.',
    atmosphereLine,
    avoidLine,
    toneLine,
    '',
    'Return `elements`: the placed text for this one frame.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
