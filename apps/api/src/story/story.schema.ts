import { Type, type Schema } from '@google/genai';

/**
 * The response schema the model must fill. Passing this as `responseSchema`
 * (with responseMimeType application/json) guarantees shape, so the server
 * only has to validate content, not structure. Mirrors GenerateResponse minus
 * `partial`, which the server computes.
 */
export const STORY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    frames: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          photoId: { type: Type.STRING },
          order: { type: Type.INTEGER },
          caption: { type: Type.STRING },
        },
        required: ['photoId', 'order', 'caption'],
      },
    },
  },
  required: ['frames'],
};
