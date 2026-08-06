import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Limits } from '@auto-stories/api-types';
import { ApiErrors } from '../common/api-exception';
import { positiveInt } from '../common/config.util';

/**
 * The provider's free tier, in its own units (decision 7.37). These are model
 * *calls*, not stories: one story is normally one call, but a safety-blocked
 * photo makes the generator drop it and call again, and refine's regenerate is
 * another call. Counting calls is the only way the number here means the same
 * thing as the number the provider is counting.
 */
const DEFAULT_CALLS_PER_DAY = 20;
const DEFAULT_CALLS_PER_MINUTE = 5;

/**
 * What one visitor may start per day. With twenty calls to go round, a visitor
 * who could take five would be a quarter of everything; two leaves room for
 * roughly ten different people to get a story out of a day.
 */
const DEFAULT_IP_DAILY_LIMIT = 2;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A fixed-window counter: how many hits since `start`. */
interface Window {
  start: number;
  count: number;
}

/**
 * The shared free tier's fair-use guardrails (approach 4.1, revised in 7.37).
 * One key, no accounts, and a genuinely small budget — twenty model calls a day
 * and five a minute — so three counters protect it:
 *
 *  - **per visitor, per day** → `rate_limited`, so one person cannot take the
 *    day. Enforced on the request, before anything is enqueued.
 *  - **calls per day** → `quota_exhausted`, so the key is never drained. Spent
 *    at the model call, which is what the provider counts.
 *  - **calls per minute** → *not* an error. The work is already queued one at a
 *    time and the user is already waiting, so a burst waits for the next minute
 *    rather than failing. Shaping beats refusing when there is nothing the user
 *    could have done differently.
 *
 * Once a limit is reached nothing reaches the provider: both refusals are
 * thrown before the call is made, so a refused request costs no quota.
 *
 * In-memory and per-process is deliberate: the app ships as one container, so a
 * process-local counter is the whole surface. Windows are fixed (aligned to the
 * clock), which is enough for best-effort protection and keeps this trivially
 * testable via the injectable {@link now} clock.
 */
@Injectable()
export class FairUseService {
  /** Wall clock, overridable in tests. */
  now: () => number = () => Date.now();

  private readonly callsPerDay: number;
  private readonly callsPerMinute: number;
  private readonly ipDailyLimit: number;
  private day: Window = { start: 0, count: 0 };
  private minute: Window = { start: 0, count: 0 };
  private readonly ipWindows = new Map<string, Window>();

  constructor(config: ConfigService) {
    // Coerced, not just typed — see positiveInt. `get<number>` is an assertion,
    // and an env var is always a string.
    this.callsPerDay = positiveInt(
      config.get('DAILY_GENERATION_CAP'),
      DEFAULT_CALLS_PER_DAY,
    );
    this.callsPerMinute = positiveInt(
      config.get('CALLS_PER_MINUTE'),
      DEFAULT_CALLS_PER_MINUTE,
    );
    this.ipDailyLimit = positiveInt(
      config.get('RATE_LIMIT_PER_DAY'),
      DEFAULT_IP_DAILY_LIMIT,
    );
  }

  /**
   * Count one request from `ip` against its day.
   * @throws rate_limited once that visitor has had their share for the day.
   */
  enforceIp(ip: string): void {
    const dayStart = this.windowStart(DAY_MS);
    const window = this.ipWindows.get(ip);
    if (!window || window.start !== dayStart) {
      this.ipWindows.set(ip, { start: dayStart, count: 1 });
      return;
    }
    if (window.count >= this.ipDailyLimit) {
      throw ApiErrors.rateLimited(undefined, this.dayResetAt());
    }
    window.count += 1;
  }

  /**
   * Reserve one model call against the day's budget, immediately before making
   * it. Throws rather than calling, so a refusal never costs the provider
   * anything.
   *
   * @throws quota_exhausted once the day's calls are spent.
   */
  reserveCall(): void {
    this.rollWindows();
    if (this.day.count >= this.callsPerDay) {
      throw ApiErrors.quotaExhausted(undefined, this.dayResetAt());
    }
    this.day.count += 1;
    this.minute.count += 1;
  }

  /**
   * How long to hold off before the next model call, so the per-minute ceiling
   * is respected. Zero when there is room now.
   *
   * A wait, not a refusal: the caller is already on the generating screen, the
   * queue runs one job at a time anyway, and "your turn is in nine seconds" is
   * not something a user can act on — so we simply take the nine seconds.
   */
  msUntilCallAllowed(): number {
    this.rollWindows();
    if (this.minute.count < this.callsPerMinute) return 0;
    return Math.max(0, this.minute.start + MINUTE_MS - this.now());
  }

  /**
   * What `ip` has left, for the client to warn with *before* the user does the
   * work (decision 7.36). Read-only: asking how much is left never spends any.
   */
  limitsFor(ip: string): Limits {
    const dayStart = this.windowStart(DAY_MS);
    const window = this.ipWindows.get(ip);
    const used = window && window.start === dayStart ? window.count : 0;
    const dayExhausted = this.dayCount() >= this.callsPerDay;
    return {
      remaining: Math.max(0, this.ipDailyLimit - used),
      limit: this.ipDailyLimit,
      resetAt: this.dayResetAt(),
      dayExhausted,
      ...(dayExhausted ? { dayResetAt: this.dayResetAt() } : {}),
    };
  }

  /** Drop the day and minute counters once their window has rolled over. */
  private rollWindows(): void {
    const dayStart = this.windowStart(DAY_MS);
    if (this.day.start !== dayStart) this.day = { start: dayStart, count: 0 };
    const minuteStart = this.windowStart(MINUTE_MS);
    if (this.minute.start !== minuteStart) {
      this.minute = { start: minuteStart, count: 0 };
    }
  }

  /** Model calls spent in the current day window. */
  private dayCount(): number {
    return this.day.start === this.windowStart(DAY_MS) ? this.day.count : 0;
  }

  /** When the day rolls over, ISO-8601. */
  private dayResetAt(): string {
    return new Date(this.windowStart(DAY_MS) + DAY_MS).toISOString();
  }

  /** Start of the clock-aligned window of the given size containing `now`. */
  private windowStart(sizeMs: number): number {
    const now = this.now();
    return now - (now % sizeMs);
  }
}
