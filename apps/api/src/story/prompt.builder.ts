import type { Tone } from '@auto-stories/api-types';

/**
 * Builds the instruction sent to the model alongside the photos. Pure and
 * deterministic so it can be unit-tested; the model call itself is not.
 *
 * The rules mirror docs/phase-1 decisions: aim for the 5–7 frame engagement
 * sweet spot rather than cutting to the bone (2.5), order by the story line and
 * what's visible (strongest hook first → payoff, 2.1), use capture time only as
 * a soft hint, and write specific, grounded captions in the requested tone.
 */
export function buildPrompt(
  story: string,
  tone?: Tone,
  mustInclude?: readonly string[],
): string {
  const toneLine = tone
    ? `\n- Match this tone: ${tone}. Let it color word choice, not the facts.`
    : '';

  // Photos added by hand during refine must appear and be captioned, even if
  // the story is already at the target length (decision 2.5).
  const includeLine =
    mustInclude && mustInclude.length
      ? `\n- You MUST include these photos and give each its own caption, even beyond the 5–7 target — they were added by hand: ${mustInclude.join(', ')}.`
      : '';

  return [
    'You arrange a batch of photos into a coherent Instagram Story.',
    'Each image is provided in the same order as the photos array; the caption text before each image is its photoId.',
    '',
    `The story, in the user's words: "${story}"`,
    '',
    'Do this:',
    '- Aim for a story of 5 to 7 frames, going up to 10 when the batch genuinely has that many distinct moments. Do not trim it down to 3 or 4 unless that is honestly all the batch supports — a story that is too short throws away the day.',
    '- Keep every distinct moment. Leave a photo out only when it is a near-duplicate of one you already kept, is blurry or badly exposed, or adds nothing new — never just because there are many good photos.',
    '- Put the chosen photos in narrative order: the single strongest photo (best visual and clearest story hook) goes first, then build, then the payoff last. The first frame decides whether the rest gets watched.',
    '- Order by the story line and what is actually visible in each photo, NOT by the capture timestamp (treat any timestamp as a soft hint only).',
    '- Keep captions SHORT so the photo can breathe — a few words, often just one ("Yummy.", "Golden hour"). The image is the payoff; never pad, and never write a full sentence when a phrase will do. The story lives in the SEQUENCE across frames, not in long text on any single photo — a terse caption per frame still tells the whole story. Ground the few words you do write in the user\'s specifics (names, occasion, place) and what the photo shows, so they feel true rather than generic.',
    '- For each caption, choose a style that fits the mood, picking one value from each set: font (inter, playfair, space-mono, caveat); weight (regular, bold); case (normal, upper); align (left, center, right); size (s, m, l); position (top-left, top-center, top-right, bottom-left, bottom-center, bottom-right — keep the caption off faces and the main subject in the middle); letterbox (solid, blur — how to fill the frame when the photo is not 9:16). Text colour and any backdrop are handled automatically, so do not choose those.',
    '- Optionally, instead of one caption, place up to 2 short text `texts` blocks on a frame — a small line and a bigger line in different spots — but only when it makes the frame more engaging (a phrase pointing at something in the photo, a beat above it); usually one is enough, and a frame can have none. Each block is { text, font, weight, case, align, size, position } (same sets as the style above; give each its own size and position). Keep every block short.',
    '- Optionally add `suggestions`: 0 to 2 Instagram add-ons per frame, and only when they genuinely fit the moment — most frames should have none. Each is { type (location, mention, gif, poll, music), query, position (same six zones as above; omit it for music, which is story-level), confidence (0..1) }. The `query` is the exact text the user will search for in Instagram, so it must be accurate and searchable: for a place or account use its real NAME, not an @handle, and only when you are confident of it from the story line or what the photo clearly shows; for a gif a short search term; for music a song or a genre/mood; for a poll a short question. When unsure, lower the confidence or leave the suggestion out — never invent a place, handle, or song you cannot stand behind.',
    "- Don't overload a photo. Every mark competes with the image, so prefer a clean frame: a short caption, or a single suggestion — both only when each genuinely adds to the moment, not by default.",
    toneLine,
    includeLine,
    '',
    'Return only the chosen photos, each as a frame with its photoId, its 1-based order, its caption, its style, and any suggestions.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
