/**
 * Reading a configured number as a number.
 *
 * `ConfigService.get<number>('X', 1)` is a type *assertion*, not a conversion:
 * an env var always arrives as a string, so the value that comes back is
 * `'4000'` typed as `number`. TypeScript is satisfied and the runtime is not.
 * That produced two live defects — a contract field served as `"limit": "3"`
 * where an integer was promised, and `AbortSignal.timeout('4000')` throwing
 * `TypeError` on every single generation, which surfaced to users as "the story
 * engine is unavailable" (decision 7.36).
 *
 * So every numeric setting is read through here instead.
 */
export function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
