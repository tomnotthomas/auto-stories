import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Limits } from '@auto-stories/api-types';
import { ApiErrors } from '../common/api-exception';
import { positiveInt } from '../common/config.util';

/** Stop calling Gemini past this many stories/day (headroom under the free tier). */
const DEFAULT_DAILY_CAP = 1200;

/** Per-IP ceiling within a rolling hour window. */
const DEFAULT_IP_HOURLY_LIMIT = 5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A fixed-window counter: how many hits since `start`. */
interface Window {
  start: number;
  count: number;
}

/**
 * The shared free tier's fair-use guardrails (approach 4.1). Two in-memory
 * counters protect one shared Gemini key without accounts:
 *  - a per-IP hourly limit → rate_limited (429), so no single client floods it;
 *  - a global daily budget → quota_exhausted (503), so the key is never drained.
 *
 * In-memory and per-process is deliberate: the app ships as one container, so a
 * process-local counter is the whole surface. Both windows are fixed (aligned
 * to the clock), which is enough for best-effort abuse defense and keeps this
 * trivially testable via the injectable {@link now} clock.
 */
@Injectable()
export class FairUseService {
  /** Wall clock, overridable in tests. */
  now: () => number = () => Date.now();

  private readonly dailyCap: number;
  private readonly ipHourlyLimit: number;
  private daily: Window = { start: 0, count: 0 };
  private readonly ipWindows = new Map<string, Window>();

  constructor(config: ConfigService) {
    // Coerced, not just typed — see positiveInt. Left raw this reached the
    // contract as `"limit": "3"`, a string where an integer was promised.
    this.dailyCap = positiveInt(
      config.get('DAILY_GENERATION_CAP'),
      DEFAULT_DAILY_CAP,
    );
    this.ipHourlyLimit = positiveInt(
      config.get('RATE_LIMIT_PER_HOUR'),
      DEFAULT_IP_HOURLY_LIMIT,
    );
  }

  /**
   * Count one request from `ip` against its hourly window.
   * @throws rate_limited once the IP is over the limit for the current hour.
   */
  enforceIp(ip: string): void {
    const hourStart = this.windowStart(HOUR_MS);
    const window = this.ipWindows.get(ip);
    if (!window || window.start !== hourStart) {
      this.ipWindows.set(ip, { start: hourStart, count: 1 });
      return;
    }
    if (window.count >= this.ipHourlyLimit) {
      throw ApiErrors.rateLimited(undefined, this.hourResetAt());
    }
    window.count += 1;
  }

  /**
   * Reserve one story against the global daily budget, just before a model call.
   * @throws quota_exhausted once the day's budget is spent.
   */
  consumeDailyBudget(): void {
    const dayStart = this.windowStart(DAY_MS);
    if (this.daily.start !== dayStart) {
      this.daily = { start: dayStart, count: 0 };
    }
    if (this.daily.count >= this.dailyCap) {
      throw ApiErrors.quotaExhausted(undefined, this.dayResetAt());
    }
    this.daily.count += 1;
  }

  /**
   * What `ip` has left, for the client to warn with *before* the user does the
   * work (decision 7.36). Read-only: asking how much is left never spends any.
   */
  limitsFor(ip: string): Limits {
    const hourStart = this.windowStart(HOUR_MS);
    const window = this.ipWindows.get(ip);
    const used = window && window.start === hourStart ? window.count : 0;
    const dayExhausted = this.dayCount() >= this.dailyCap;
    return {
      remaining: Math.max(0, this.ipHourlyLimit - used),
      limit: this.ipHourlyLimit,
      resetAt: this.hourResetAt(),
      dayExhausted,
      ...(dayExhausted ? { dayResetAt: this.dayResetAt() } : {}),
    };
  }

  /** How many stories the shared budget has spent in the current day window. */
  private dayCount(): number {
    return this.daily.start === this.windowStart(DAY_MS) ? this.daily.count : 0;
  }

  /** When the current hour window rolls over, ISO-8601. */
  private hourResetAt(): string {
    return new Date(this.windowStart(HOUR_MS) + HOUR_MS).toISOString();
  }

  /** When the shared daily budget resets, ISO-8601. */
  private dayResetAt(): string {
    return new Date(this.windowStart(DAY_MS) + DAY_MS).toISOString();
  }

  /** Start of the clock-aligned window of the given size containing `now`. */
  private windowStart(sizeMs: number): number {
    const now = this.now();
    return now - (now % sizeMs);
  }
}
