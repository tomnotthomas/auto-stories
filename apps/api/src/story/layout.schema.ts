import { Type, type Schema } from '@google/genai';

/**
 * The response schema for one frame's art-directed layout (decision 7.21). Passed
 * as `responseSchema` so the layout agent's output is shape-guaranteed; the server
 * still validates content with `normalizeLayout`. Mirrors the `Layout` contract.
 */
export const LAYOUT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    elements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, enum: ['label', 'title', 'deck'] },
          text: { type: Type.STRING },
          font: {
            type: Type.STRING,
            enum: ['inter', 'playfair', 'space-mono', 'caveat'],
          },
          weight: { type: Type.STRING, enum: ['regular', 'bold'] },
          case: { type: Type.STRING, enum: ['normal', 'upper'] },
          align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
          size: { type: Type.INTEGER },
          tracking: { type: Type.STRING, enum: ['tight', 'normal', 'wide'] },
          leading: { type: Type.STRING, enum: ['tight', 'normal', 'loose'] },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          anchor: {
            type: Type.STRING,
            enum: [
              'top-left',
              'top',
              'top-right',
              'left',
              'center',
              'right',
              'bottom-left',
              'bottom',
              'bottom-right',
            ],
          },
          stack: { type: Type.BOOLEAN },
          accent: { type: Type.BOOLEAN },
          underline: { type: Type.BOOLEAN },
        },
        required: [
          'role',
          'text',
          'font',
          'weight',
          'case',
          'align',
          'size',
          'tracking',
          'leading',
          'x',
          'y',
          'anchor',
        ],
      },
    },
  },
  required: ['elements'],
};
