/**
 * The bundled faces the canvas export paints with. A Look names its own font
 * stacks (see `looks/magazine.ts`) — this module only makes sure those faces are
 * actually loaded before the canvas draws, and holds the length-based type fit.
 */

/** The self-hosted display face (bundled woff2, @font-face in styles.css).
 * Loaded before the canvas draws via {@link loadCaptionFonts}. */
export const DISPLAY_FONT = 'Bricolage Grotesque';

/**
 * Ensure the display face is loaded before a caption is drawn to canvas — a
 * canvas 2D context paints with whatever is loaded *now* and never waits, so the
 * export would fall back to a system font otherwise. Both caption weights are
 * requested. No-op where the Font Loading API is unavailable (e.g. tests).
 */
export async function loadCaptionFonts(): Promise<void> {
  const fonts = (globalThis as { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.all([
    fonts.load(`400 64px "${DISPLAY_FONT}"`),
    // 600 is the Magazine Look's byline weight (7.24). The canvas paints with
    // whatever is loaded at that instant, so every weight a Look asks for has to
    // be named here or the PNG silently falls back to a system face.
    fonts.load(`600 64px "${DISPLAY_FONT}"`),
    fonts.load(`700 64px "${DISPLAY_FONT}"`),
    fonts.load('400 64px "Fraunces"'),
    fonts.load('700 64px "Fraunces"'),
    fonts.load('400 64px "Shantell Sans"'),
    fonts.load('700 64px "Shantell Sans"'),
  ]).catch(() => undefined);
}

/**
 * Content-aware type fit: a size multiplier from the text's length, so a short
 * headline reads big and a long one shrinks to fit instead of overflowing.
 * Deterministic and clamped.
 *
 * TODO(slice 3): apply this per Look rather than globally — each Look declares
 * its own length budget (frame-harmony-plan slice 3). Held here, unused, until
 * that lands; the legacy caption layer that called it is gone (7.25 slice 1).
 */
export function fitMultiplier(text: string): number {
  const length = text.trim().length;
  // ~14 chars → 1.25 (headline), decaying to the floor by ~110 chars.
  const raw = 1.25 - (length - 14) * 0.006;
  return Math.min(1.25, Math.max(0.72, Math.round(raw * 100) / 100));
}
