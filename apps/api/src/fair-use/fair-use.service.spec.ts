import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-exception';
import { FairUseService } from './fair-use.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** ConfigService stub returning the given overrides (else the caller default). */
function configWith(values: Record<string, number> = {}): ConfigService {
  return {
    get: <T>(key: string, fallback: T): T => (values[key] as T) ?? fallback,
  } as unknown as ConfigService;
}

/** Build a service with a controllable clock and small caps for testing. */
function serviceWith(values: Record<string, number> = {}): {
  service: FairUseService;
  setNow: (ms: number) => void;
} {
  const service = new FairUseService(configWith(values));
  let current = 0;
  service.now = () => current;
  return { service, setNow: (ms) => (current = ms) };
}

describe('FairUseService', () => {
  describe('per-IP rate limit', () => {
    it('allows requests up to the hourly limit', () => {
      const { service } = serviceWith({ RATE_LIMIT_PER_HOUR: 3 });
      expect(() => {
        service.enforceIp('1.1.1.1');
        service.enforceIp('1.1.1.1');
        service.enforceIp('1.1.1.1');
      }).not.toThrow();
    });

    it('throws rate_limited once an IP exceeds the hourly limit', () => {
      const { service } = serviceWith({ RATE_LIMIT_PER_HOUR: 2 });
      service.enforceIp('1.1.1.1');
      service.enforceIp('1.1.1.1');

      let caught: unknown;
      try {
        service.enforceIp('1.1.1.1');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiException);
      expect((caught as ApiException).code).toBe('rate_limited');
    });

    it('tracks each IP independently', () => {
      const { service } = serviceWith({ RATE_LIMIT_PER_HOUR: 1 });
      expect(() => {
        service.enforceIp('1.1.1.1');
        service.enforceIp('2.2.2.2');
      }).not.toThrow();
    });

    it('resets an IP window after the hour rolls over', () => {
      const { service, setNow } = serviceWith({ RATE_LIMIT_PER_HOUR: 1 });
      setNow(30 * 60 * 1000); // 00:30
      service.enforceIp('1.1.1.1');
      setNow(30 * 60 * 1000 + HOUR); // 01:30 — new window
      expect(() => service.enforceIp('1.1.1.1')).not.toThrow();
    });
  });

  describe('global daily budget', () => {
    it('allows calls up to the daily cap', () => {
      const { service } = serviceWith({ DAILY_GENERATION_CAP: 2 });
      expect(() => {
        service.consumeDailyBudget();
        service.consumeDailyBudget();
      }).not.toThrow();
    });

    it('throws quota_exhausted once the daily cap is spent', () => {
      const { service } = serviceWith({ DAILY_GENERATION_CAP: 1 });
      service.consumeDailyBudget();

      let caught: unknown;
      try {
        service.consumeDailyBudget();
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiException);
      expect((caught as ApiException).code).toBe('quota_exhausted');
    });

    it('resets the budget after the day rolls over', () => {
      const { service, setNow } = serviceWith({ DAILY_GENERATION_CAP: 1 });
      setNow(12 * HOUR); // midday
      service.consumeDailyBudget();
      setNow(12 * HOUR + DAY); // next midday — new day
      expect(() => service.consumeDailyBudget()).not.toThrow();
    });
  });

  it('applies sane defaults when no config is provided', () => {
    // Default cap is 1200 and per-IP is a few/hour; a single call is fine.
    const { service } = serviceWith();
    expect(() => {
      service.enforceIp('1.1.1.1');
      service.consumeDailyBudget();
    }).not.toThrow();
  });
});
