import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-exception';
import { FairUseService } from './fair-use.service';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
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

/** The error code of a refusal, or null when the call went through. */
function refusalFrom(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiException);
    return (err as ApiException).code;
  }
}

describe('FairUseService', () => {
  describe('what one visitor may take in a day', () => {
    it('allows a visitor up to their daily share', () => {
      const { service } = serviceWith({ RATE_LIMIT_PER_DAY: 2 });
      expect(() => {
        service.enforceIp('1.1.1.1');
        service.enforceIp('1.1.1.1');
      }).not.toThrow();
    });

    it('turns the same visitor away once they have had it', () => {
      const { service } = serviceWith({ RATE_LIMIT_PER_DAY: 2 });
      service.enforceIp('1.1.1.1');
      service.enforceIp('1.1.1.1');

      expect(refusalFrom(() => service.enforceIp('1.1.1.1'))).toBe(
        'rate_limited',
      );
    });

    it('says their share comes back tomorrow, not in an hour', () => {
      const { service, setNow } = serviceWith({ RATE_LIMIT_PER_DAY: 1 });
      setNow(3 * HOUR);
      service.enforceIp('1.1.1.1');

      try {
        service.enforceIp('1.1.1.1');
        throw new Error('expected a refusal');
      } catch (err) {
        expect((err as ApiException).retryAt).toBe(new Date(DAY).toISOString());
      }
    });

    it('keeps visitors apart', () => {
      const { service } = serviceWith({ RATE_LIMIT_PER_DAY: 1 });
      service.enforceIp('1.1.1.1');

      expect(refusalFrom(() => service.enforceIp('2.2.2.2'))).toBeNull();
    });

    it('gives them their share back the next day', () => {
      const { service, setNow } = serviceWith({ RATE_LIMIT_PER_DAY: 1 });
      service.enforceIp('1.1.1.1');
      setNow(DAY + 1);

      expect(refusalFrom(() => service.enforceIp('1.1.1.1'))).toBeNull();
    });
  });

  describe("the day's model calls", () => {
    it('lets calls through while the budget lasts', () => {
      const { service } = serviceWith({ DAILY_GENERATION_CAP: 20 });
      expect(() => {
        for (let i = 0; i < 20; i++) service.reserveCall();
      }).not.toThrow();
    });

    it('refuses once the day is spent, before anything reaches the provider', () => {
      const { service } = serviceWith({ DAILY_GENERATION_CAP: 2 });
      service.reserveCall();
      service.reserveCall();

      expect(refusalFrom(() => service.reserveCall())).toBe('quota_exhausted');
    });

    it('says the budget returns tomorrow', () => {
      const { service, setNow } = serviceWith({ DAILY_GENERATION_CAP: 1 });
      setNow(5 * HOUR);
      service.reserveCall();

      try {
        service.reserveCall();
        throw new Error('expected a refusal');
      } catch (err) {
        expect((err as ApiException).retryAt).toBe(new Date(DAY).toISOString());
      }
    });

    it('starts fresh the next day', () => {
      const { service, setNow } = serviceWith({ DAILY_GENERATION_CAP: 1 });
      setNow(12 * HOUR);
      service.reserveCall();
      setNow(12 * HOUR + DAY);

      expect(refusalFrom(() => service.reserveCall())).toBeNull();
    });
  });

  describe("the minute's model calls", () => {
    it('has room while the minute is not full', () => {
      const { service } = serviceWith({ CALLS_PER_MINUTE: 5 });
      for (let i = 0; i < 4; i++) service.reserveCall();

      expect(service.msUntilCallAllowed()).toBe(0);
    });

    it('asks the caller to wait for the next minute rather than failing', () => {
      const { service, setNow } = serviceWith({ CALLS_PER_MINUTE: 2 });
      setNow(20_000);
      service.reserveCall();
      service.reserveCall();

      // A wait, not a refusal: the user is already waiting and could not have
      // done anything differently.
      expect(service.msUntilCallAllowed()).toBe(40_000);
      expect(refusalFrom(() => service.reserveCall())).toBeNull();
    });

    it('opens up again once the minute rolls over', () => {
      const { service, setNow } = serviceWith({ CALLS_PER_MINUTE: 1 });
      service.reserveCall();
      setNow(MINUTE + 1);

      expect(service.msUntilCallAllowed()).toBe(0);
    });

    it('never asks for a negative wait', () => {
      const { service, setNow } = serviceWith({ CALLS_PER_MINUTE: 1 });
      setNow(30_000);
      service.reserveCall();
      setNow(59_999);

      expect(service.msUntilCallAllowed()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('the defaults are the free tier we are actually on', () => {
    it('allows twenty model calls a day and no more', () => {
      const { service } = serviceWith();
      for (let i = 0; i < 20; i++) service.reserveCall();

      expect(refusalFrom(() => service.reserveCall())).toBe('quota_exhausted');
    });

    it('allows five model calls a minute before anyone is asked to wait', () => {
      const { service } = serviceWith();
      for (let i = 0; i < 5; i++) service.reserveCall();

      expect(service.msUntilCallAllowed()).toBeGreaterThan(0);
    });

    it('gives one visitor two stories a day', () => {
      const { service } = serviceWith();
      service.enforceIp('1.1.1.1');
      service.enforceIp('1.1.1.1');

      expect(refusalFrom(() => service.enforceIp('1.1.1.1'))).toBe(
        'rate_limited',
      );
    });
  });
});
