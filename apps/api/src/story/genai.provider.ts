import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GENAI } from './story.constants';

/**
 * Provides the shared GoogleGenAI client, built from the server-only
 * GOOGLE_CLOUD_API_KEY. Fails fast at startup if the key is missing — the key
 * never reaches the browser (architecture 3.1).
 */
export const genaiProvider: Provider = {
  provide: GENAI,
  inject: [ConfigService],
  useFactory: (config: ConfigService): GoogleGenAI => {
    const apiKey = config.get<string>('GOOGLE_CLOUD_API_KEY');
    if (!apiKey) {
      throw new Error(
        'GOOGLE_CLOUD_API_KEY is not set — the story engine cannot start.',
      );
    }
    return new GoogleGenAI({ apiKey });
  },
};
