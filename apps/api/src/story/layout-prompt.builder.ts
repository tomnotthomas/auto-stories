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
    '- Be restrained. MOST frames want ONE element — a single, well-placed line. Add a second element only when it truly earns its place. NEVER more than two. Extra text buries the photo.',
    '- NO chrome. Never add a frame number, an index like "01" or "1/5", a date, or anything that labels the photo\'s position in the story. That reads as a brand template, not a person.',
    '- Rewrite the meaning in a FIRST-PERSON, specific, slightly imperfect voice ("mum cried up here", not "Zermatt"). Keep it short.',
    '- At most ONE handwritten (caveat) element, as the personal signature — a date, a name, an aside. Everything else is set type. One human gesture, not a scrapbook.',
    '- Keep every element fully inside a safe margin (x and y roughly 6–94).',
    "- Do NOT pick a colour value — the app computes legible colour from the photo. But like a designer, you MAY add ONE pop of colour: set `accent: true` on a single element (a word, or a short line) so it takes the story's accent colour, and optionally `underline: true` on one element for a hand-drawn line in that colour. Use each at most once per frame, or not at all. Compose only type, placement, and these two flags.",
    atmosphereLine,
    avoidLine,
    toneLine,
    '',
    'Return `elements`: the placed text for this one frame.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
