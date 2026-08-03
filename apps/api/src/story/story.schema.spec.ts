import type { Schema } from '@google/genai';
import { STORY_RESPONSE_SCHEMA } from './story.schema';

/** The frame item schema, which is what the model is actually constrained by. */
function frameItem(): Schema {
  const items = STORY_RESPONSE_SCHEMA.properties?.['frames']?.items;
  if (!items) throw new Error('frames.items missing from the schema');
  return items;
}

describe('STORY_RESPONSE_SCHEMA', () => {
  it('asks for the story-level look and the frames', () => {
    expect(Object.keys(STORY_RESPONSE_SCHEMA.properties ?? {}).sort()).toEqual([
      'frames',
      'look',
    ]);
    expect(STORY_RESPONSE_SCHEMA.required).toEqual(
      expect.arrayContaining(['frames', 'look']),
    );
  });

  it('offers exactly the six Looks', () => {
    expect(STORY_RESPONSE_SCHEMA.properties?.['look']?.enum).toEqual([
      'quiet-editorial',
      'film-postcard',
      'bold-poster',
      'scrapbook',
      'minimal',
      'magazine-masthead',
    ]);
  });

  // Decision 7.25: one text per frame. Decision 7.24: no geometry crosses here.
  it('gives a frame only its photo, its order, its words and its suggestions', () => {
    expect(Object.keys(frameItem().properties ?? {}).sort()).toEqual([
      'emphasis',
      'headline',
      'kicker',
      'order',
      'photoId',
      'suggestions',
    ]);
  });

  it('requires the photo, the order and the headline on every frame', () => {
    expect(frameItem().required).toEqual(['photoId', 'order', 'headline']);
  });

  it('keeps the suggestion shape the client still renders', () => {
    const suggestion = frameItem().properties?.['suggestions']?.items;
    expect(Object.keys(suggestion?.properties ?? {}).sort()).toEqual([
      'confidence',
      'position',
      'query',
      'type',
    ]);
    expect(suggestion?.required).toEqual(['type', 'query', 'confidence']);
  });
});
