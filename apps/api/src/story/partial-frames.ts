/**
 * Reads the frames the model has finished writing out of a response that is
 * still arriving (decision 7.30).
 *
 * The model streams one JSON document, so until the last chunk lands the text
 * is not parseable. But each *frame* inside it is complete long before the
 * document is, and a frame the model has finished writing is a choice it has
 * finished making — which is the thing the generating screen exists to show. So
 * this scans the partial text for objects inside the `frames` array whose braces
 * have balanced, and parses those.
 *
 * Deliberately tolerant: anything it cannot read is skipped, never thrown. What
 * it returns only drives the reveal — the authoritative story is the full parse
 * of the finished response.
 */
export function completeFrames(text: string): unknown[] {
  const start = arrayStart(text);
  if (start < 0) return [];

  const frames: unknown[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        frames.push(parseOrSkip(text.slice(objectStart, i + 1)));
        objectStart = -1;
      }
    } else if (char === ']' && depth === 0) {
      break; // the frames array is closed; anything after it is not a frame
    }
  }

  return frames.filter((frame) => frame !== undefined);
}

/** Index just past the `[` that opens the `frames` array, or -1. */
function arrayStart(text: string): number {
  const key = text.indexOf('"frames"');
  if (key < 0) return -1;
  const open = text.indexOf('[', key);
  return open < 0 ? -1 : open + 1;
}

function parseOrSkip(chunk: string): unknown {
  try {
    return JSON.parse(chunk);
  } catch {
    return undefined;
  }
}
