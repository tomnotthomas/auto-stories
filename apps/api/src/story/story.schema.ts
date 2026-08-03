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
    // One design language for the whole story (decision 7.24). The model names
    // it; the client composes every frame from it — no geometry crosses here.
    look: {
      type: Type.STRING,
      enum: [
        'quiet-editorial',
        'film-postcard',
        'bold-poster',
        'scrapbook',
        'minimal',
        'magazine-masthead',
      ],
    },
    frames: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          photoId: { type: Type.STRING },
          order: { type: Type.INTEGER },
          caption: { type: Type.STRING },
          // The words the chosen Look sets: an optional line above, the main
          // line, and an optional phrase inside it to mark (decision 7.24).
          kicker: { type: Type.STRING },
          headline: { type: Type.STRING },
          emphasis: { type: Type.STRING },
          style: {
            type: Type.OBJECT,
            properties: {
              font: {
                type: Type.STRING,
                enum: ['inter', 'playfair', 'space-mono', 'caveat'],
              },
              weight: { type: Type.STRING, enum: ['regular', 'bold'] },
              case: { type: Type.STRING, enum: ['normal', 'upper'] },
              align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
              size: { type: Type.STRING, enum: ['s', 'm', 'l'] },
              position: {
                type: Type.STRING,
                enum: [
                  'top-left',
                  'top-center',
                  'top-right',
                  'bottom-left',
                  'bottom-center',
                  'bottom-right',
                ],
              },
              letterbox: { type: Type.STRING, enum: ['solid', 'blur'] },
            },
            required: [
              'font',
              'weight',
              'case',
              'align',
              'size',
              'position',
              'letterbox',
            ],
          },
          texts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                font: {
                  type: Type.STRING,
                  enum: ['inter', 'playfair', 'space-mono', 'caveat'],
                },
                weight: { type: Type.STRING, enum: ['regular', 'bold'] },
                case: { type: Type.STRING, enum: ['normal', 'upper'] },
                align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                size: { type: Type.STRING, enum: ['s', 'm', 'l'] },
                position: {
                  type: Type.STRING,
                  enum: [
                    'top-left',
                    'top-center',
                    'top-right',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right',
                  ],
                },
              },
              required: [
                'text',
                'font',
                'weight',
                'case',
                'align',
                'size',
                'position',
              ],
            },
          },
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
                position: {
                  type: Type.STRING,
                  enum: [
                    'top-left',
                    'top-center',
                    'top-right',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right',
                  ],
                },
                confidence: { type: Type.NUMBER },
              },
              required: ['type', 'query', 'confidence'],
            },
          },
        },
        // `suggestions` is intentionally optional — most frames have none, and
        // so are `kicker`/`emphasis`, which most frames should leave out.
        required: ['photoId', 'order', 'caption', 'headline', 'style'],
      },
    },
  },
  required: ['frames', 'look'],
};
