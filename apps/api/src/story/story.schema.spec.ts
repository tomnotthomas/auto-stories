import { Type, type Schema } from '@google/genai';
import { LOOKS } from './caption-style';
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

  // `responseSchema` is a HARD constraint: a Look missing from this enum cannot
  // be emitted by the model whatever the prompt says. It listed six while the
  // prompt described thirty-two, so twenty-six Looks were unreachable — the
  // third place 7.27's failure hid. Asserting equality with LOOKS, rather than a
  // hand-written list, is what stops it happening a fourth time.
  it('offers every Look the client can render', () => {
    expect(STORY_RESPONSE_SCHEMA.properties?.['look']?.enum).toEqual([
      ...LOOKS,
    ]);
  });

  it('offers all thirty-two Looks, not a subset', () => {
    expect(STORY_RESPONSE_SCHEMA.properties?.['look']?.enum).toHaveLength(32);
  });

  // Decision 7.25: one text per frame. Decision 7.24: no geometry crosses here.
  it('gives a frame only its photo, its order, its density, its words and its suggestions', () => {
    expect(Object.keys(frameItem().properties ?? {}).sort()).toEqual([
      'density',
      'emphasis',
      'headline',
      'kicker',
      'order',
      'photoId',
      'suggestions',
    ]);
  });

  // Decision 7.26: the rung the model picks is the brief it shares with the
  // design, so the schema constrains it to the five the client can set.
  it('offers exactly the five densities, as a string', () => {
    const density = frameItem().properties?.['density'];
    expect(density?.type).toBe(Type.STRING);
    expect(density?.enum).toEqual([
      'silent',
      'beat',
      'line',
      'thought',
      'question',
    ]);
  });

  it('requires the photo, the order and the headline on every frame', () => {
    // `density` stays optional: absent means "read it from the headline",
    // which the client can do from its length (decision 7.26).
    expect(frameItem().required).toEqual(['photoId', 'order', 'headline']);
  });

  // Decision 7.25: the client places every add-on itself, so the model is not
  // asked for a zone — what it may say is what the add-on is and how sure it is.
  it('keeps the suggestion shape the client still renders, with no placement', () => {
    const suggestion = frameItem().properties?.['suggestions']?.items;
    expect(Object.keys(suggestion?.properties ?? {}).sort()).toEqual([
      'confidence',
      'query',
      'type',
    ]);
    expect(suggestion?.required).toEqual(['type', 'query', 'confidence']);
  });
});
