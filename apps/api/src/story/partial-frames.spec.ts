import { completeFrames } from './partial-frames';

/** One frame as the model writes it, as JSON text. */
const frame = (photoId: string, order: number, headline: string): string =>
  `{"photoId":"${photoId}","order":${order},"headline":"${headline}"}`;

describe('completeFrames', () => {
  it('finds nothing before the frames array has started', () => {
    expect(completeFrames('')).toEqual([]);
    expect(completeFrames('{"look":"magazine-masthead"')).toEqual([]);
    expect(completeFrames('{"look":"magazine-masthead","frames":[')).toEqual(
      [],
    );
  });

  it('returns a frame as soon as its object closes', () => {
    const text = `{"look":"magazine-masthead","frames":[${frame('p1', 1, 'One')}`;
    expect(completeFrames(text)).toEqual([
      { photoId: 'p1', order: 1, headline: 'One' },
    ]);
  });

  it('ignores the object still being written', () => {
    const text =
      `{"frames":[${frame('p1', 1, 'One')},` +
      `{"photoId":"p2","order":2,"head`;
    expect(completeFrames(text)).toHaveLength(1);
  });

  it('grows as the model keeps writing', () => {
    const one = `{"frames":[${frame('p1', 1, 'One')}`;
    const two = `${one},${frame('p2', 2, 'Two')}`;
    const closed = `${two}],"look":"magazine-masthead"}`;
    expect(completeFrames(one)).toHaveLength(1);
    expect(completeFrames(two)).toHaveLength(2);
    expect(completeFrames(closed)).toHaveLength(2);
  });

  it('is not fooled by braces and brackets inside the words', () => {
    const text = `{"frames":[{"photoId":"p1","order":1,"headline":"a { b } [ c ]"}`;
    expect(completeFrames(text)).toEqual([
      { photoId: 'p1', order: 1, headline: 'a { b } [ c ]' },
    ]);
  });

  it('is not fooled by an escaped quote in the words', () => {
    const text = `{"frames":[{"photoId":"p1","order":1,"headline":"she said \\"go\\""}`;
    expect(completeFrames(text)).toEqual([
      { photoId: 'p1', order: 1, headline: 'she said "go"' },
    ]);
  });

  it('handles a frame that carries nested objects of its own', () => {
    const nested =
      '{"photoId":"p1","order":1,"headline":"One",' +
      '"suggestions":[{"type":"location","query":"Berlin"}]}';
    expect(completeFrames(`{"frames":[${nested}`)).toEqual([
      {
        photoId: 'p1',
        order: 1,
        headline: 'One',
        suggestions: [{ type: 'location', query: 'Berlin' }],
      },
    ]);
  });

  it('stops at the end of the frames array', () => {
    const text =
      `{"frames":[${frame('p1', 1, 'One')}],` +
      `"other":[${frame('p9', 9, 'Nine')}]}`;
    expect(completeFrames(text)).toHaveLength(1);
  });

  it('skips an entry it cannot parse rather than throwing', () => {
    const text = `{"frames":[{"photoId":,},${frame('p2', 2, 'Two')}`;
    expect(completeFrames(text)).toEqual([
      { photoId: 'p2', order: 2, headline: 'Two' },
    ]);
  });

  it('finds the array however the model orders the top-level keys', () => {
    const text = `{"partial":false,"frames":[${frame('p1', 1, 'One')}`;
    expect(completeFrames(text)).toHaveLength(1);
  });
});
