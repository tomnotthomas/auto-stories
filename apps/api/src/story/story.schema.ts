import { Type, type Schema } from '@google/genai';

import { LOOKS } from './caption-style';

/**
 * The response schema the model must fill. Passing this as `responseSchema`
 * (with responseMimeType application/json) guarantees shape, so the server
 * only has to validate content, not structure. Mirrors GenerateResponse minus
 * `partial`, which the server computes.
 */
export const STORY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    // One design language for the whole story (decision 7.24). The model names
    // it; the client composes every frame from it — no geometry crosses here.
    look: {
      type: Type.STRING,
      // Derived from LOOKS, never hand-listed. `responseSchema` is a HARD
      // constraint on the model — a value missing here cannot be emitted no
      // matter what the prompt says. This enum held six while the prompt
      // described thirty-two, so twenty-six Looks were unreachable and every
      // story fell back into the same handful (7.27, third occurrence).
      enum: [...LOOKS],
    },
    frames: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          photoId: { type: Type.STRING },
          order: { type: Type.INTEGER },
          // How much this photo needs (decision 7.26) — the words half of the
          // brief the design shares. Left OUT of `required`: absent means "read
          // it from the headline", which the client does from its length.
          density: {
            type: Type.STRING,
            enum: ['silent', 'beat', 'line', 'thought', 'question'],
          },
          // The words the chosen Look sets: an optional line above, the main
          // line, and an optional phrase inside it to mark (decision 7.24).
          // `headline` is the frame's ONLY text (decision 7.25).
          kicker: { type: Type.STRING },
          headline: { type: Type.STRING },
          emphasis: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['location', 'mention', 'gif', 'poll', 'music'],
                },
                query: { type: Type.STRING },
                // No zone: the client places every add-on in the free space the
                // design leaves, and drops one with no room (decision 7.25).
                confidence: { type: Type.NUMBER },
              },
              required: ['type', 'query', 'confidence'],
            },
          },
        },
        // `suggestions` is intentionally optional — most frames have none, and
        // so are `kicker`/`emphasis`, which most frames should leave out.
        required: ['photoId', 'order', 'headline'],
      },
    },
  },
  required: ['frames', 'look'],
};
