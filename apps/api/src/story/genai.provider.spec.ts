import type { ConfigService } from '@nestjs/config';
import type { FactoryProvider } from '@nestjs/common';
import { genaiProvider } from './genai.provider';

const factory = (genaiProvider as FactoryProvider).useFactory;
const configWith = (key: string | undefined) =>
  ({ get: () => key }) as unknown as ConfigService;

describe('genaiProvider', () => {
  it('throws (fails fast) when GOOGLE_CLOUD_API_KEY is missing', () => {
    expect(() => factory(configWith(undefined))).toThrow(/GOOGLE_CLOUD_API_KEY/);
  });

  it('builds a client when the key is present', () => {
    expect(factory(configWith('test-key'))).toBeDefined();
  });
});
