import type { Tone } from '@auto-stories/api-types';

/**
 * Builds the instruction sent to the model alongside the photos. Pure and
 * deterministic so it can be unit-tested; the model call itself is not.
 *
 * The rules mirror docs/phase-1 decisions: aim for the 5–7 frame engagement
 * sweet spot rather than cutting to the bone (2.5), order by the story line and
 * what's visible (strongest hook first → payoff, 2.1), use capture time only as
 * a soft hint, and write specific, grounded words in the requested tone.
 *
 * Since 7.24 the model also names one `look` for the story and writes each
 * frame's words (headline, optional kicker/emphasis) — but no geometry: the
 * client composes every frame deterministically from the chosen Look. Since
 * 7.25 the `headline` is the frame's ONLY text, and the client also places the
 * add-ons in whatever space the design leaves free — so nothing here asks for a
 * second line, a font, a size or a placement, for the words or for an add-on.
 */
export function buildPrompt(
  story: string,
  tone?: Tone,
  mustInclude?: readonly string[],
  atmosphere?: string,
): string {
  const toneLine = tone
    ? `\n- Match this tone: ${tone}. Let it color word choice, not the facts.`
    : '';

  // The user-set atmosphere (7.21) is a mood judgement, so it steers which Look
  // the story is set in; without one the model reads the mood off the batch.
  const atmosphereLine = atmosphere
    ? `\n- The atmosphere for this story is "${atmosphere}". Let it drive which \`look\` you pick.`
    : '\n- Read the atmosphere from the photos and the story line (heartfelt, hectic, still, triumphant, tender…) and let it drive which `look` you pick.';

  // Photos added by hand during refine must appear and get their own words, even if
  // the story is already at the target length (decision 2.5).
  const includeLine =
    mustInclude && mustInclude.length
      ? `\n- You MUST include these photos and give each its own headline, even beyond the 5–7 target — they were added by hand: ${mustInclude.join(', ')}.`
      : '';

  return [
    'You arrange a batch of photos into a coherent Instagram Story.',
    'Each image is provided in the same order as the photos array; the text immediately before each image is its photoId.',
    '',
    `The story, in the user's words: "${story}"`,
    '',
    'Do this:',
    '- Aim for a story of 5 to 7 frames, going up to 10 when the batch genuinely has that many distinct moments. Do not trim it down to 3 or 4 unless that is honestly all the batch supports — a story that is too short throws away the day.',
    '- Keep every distinct moment. Leave a photo out only when it is a near-duplicate of one you already kept, is blurry or badly exposed, or adds nothing new — never just because there are many good photos.',
    '- Put the chosen photos in narrative order: the single strongest photo (best visual and clearest story hook) goes first, then build, then the payoff last. The first frame decides whether the rest gets watched.',
    '- Order by the story line and what is actually visible in each photo, NOT by the capture timestamp (treat any timestamp as a soft hint only).',
    '- Vary each `headline` to what its photo needs — do NOT put the same three or four words on every frame. Read the image and decide: when the subject is self-explanatory, keep it to a word or two so the photo breathes ("Yummy.", "Golden hour"); when the frame needs context to land — where this is, who or what it shows, how it moves the story forward — give it a fuller line, a short sentence, so a viewer grasps in the first moment how this frame fits the story. Across the whole story the headlines should have rhythm — some a single word, some a real line — never a uniform row of short labels. Ground every headline in the user\'s specifics (names, occasion, place) and what the photo shows, so it reads true, not generic.',
    '- Optionally add `suggestions`: 0 to 2 Instagram add-ons per frame, and only when they genuinely fit the moment — most frames should have none. Each is { type, query, confidence (0..1) }. The five types are equally available — location, mention, gif, poll and music — so pick whichever actually serves that frame rather than reaching for a location by default. The `query` is the exact text the user will search for in Instagram, so it must be accurate and searchable: for a place or account use its real NAME, not an @handle, and only when you are confident of it from the story line or what the photo clearly shows; for a gif a short search term; for music a song or a genre/mood; for a poll a short question. When unsure, lower the confidence or leave the suggestion out — never invent a place, handle, or song you cannot stand behind. The app decides where every add-on sits, from the free space the design leaves on that photo, and drops one when there is no room — so judge only whether an add-on is worth making and how sure you are of it.',
    "- Don't overload a photo. Every mark competes with the image, so prefer a clean frame: a short headline, or a single suggestion — both only when each genuinely adds to the moment, not by default.",
    '- Pick exactly one `look` for the whole story — the design language every frame is set in, chosen to fit the mood of these photos and this story line. Hold it across every frame; do not switch part-way. Choose from these, grouped by how loudly the design speaks.',
    '  QUIET, the photo dominates: `quiet-editorial` restrained serif; `minimal` calm and spare, lots of empty space; `gallery-label` a small museum wall label; `corner-note` one tiny line in a corner; `footer-rule` a caption under a hairline; `caption-card` a small neat caption box; `subtitle` like film subtitles at the very bottom; `edge-caps` tiny spaced capitals along the bottom edge.',
    '  EDITORIAL, structured and designed: `magazine-masthead` a National-Geographic spread; `broadsheet` a newspaper front page; `contents-page` a magazine index; `pull-quote` a quoted line, centred and large; `chapter` a chapter opener; `dateline` a wire-service dateline; `typewriter` a typed field note; `title-card` a film title card.',
    '  LOUD, graphic and shouting: `bold-poster` oversized all-caps hype; `split-block` an album-cover colour slab; `ticker` a breaking-news bar; `stencil-caps` huge screen-printed outlines; `zine` photocopied punk, tilted and raw; `duotone-band` a translucent colour band.',
    '  WARM, a nostalgic keepsake: `film-postcard` a 35mm print with a border and a stamp; `polaroid` an instant print, written in the white margin; `super-8` a sepia home movie; `faded-album` an old album page; `postcard-back` the handwritten back of a postcard; `letterbox` cinematic bars.',
    '  PERSONAL, made by hand: `scrapbook` a tilted journal page with a drawn underline; `marker` words on a highlighter swipe; `sticker-sheet` words in rounded sticker chips; `index-card` a handwritten recipe card.',
    '  Match the design to the feeling, not to the subject: a birthday is not automatically loud and a landscape is not automatically quiet. When the moment is tender, personal or nostalgic, prefer the WARM or PERSONAL groups; save LOUD for stories that are genuinely raucous. When in doubt, choose a QUIET look — the photograph is the point.',
    "- Give each frame a `headline`: the one piece of text that goes on that photo, short — the design sets it large. Optionally add a `kicker`, a short line sitting above the headline (a place, a day, a beat) — usually leave it out. Optionally add an `emphasis`: one word or a short phrase that MUST appear verbatim inside that frame's `headline`, which the design will mark; leave it out when no single word carries the line.",
    '- Do not choose any position, size, or coordinates for anything on the frame — not for these lines and not for an add-on. The design system owns placement, type size and every mark — you only choose the look, write the words, and name any add-ons worth making.',
    atmosphereLine,
    toneLine,
    includeLine,
    '',
    'Return the story-level `look`, then only the chosen photos, each as a frame with its photoId, its 1-based order, its headline (plus kicker/emphasis when they earn a place), and any suggestions.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
