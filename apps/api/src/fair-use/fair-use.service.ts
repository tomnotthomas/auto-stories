import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiErrors } from '../common/api-exception';

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
    this.dailyCap = config.get<number>(
      'DAILY_GENERATION_CAP',
      DEFAULT_DAILY_CAP,
    );
    this.ipHourlyLimit = config.get<number>(
      'RATE_LIMIT_PER_HOUR',
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
      throw ApiErrors.rateLimited();
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
      throw ApiErrors.quotaExhausted();
    }
    this.daily.count += 1;
  }

  /** Start of the clock-aligned window of the given size containing `now`. */
  private windowStart(sizeMs: number): number {
    const now = this.now();
    return now - (now % sizeMs);
  }
}
