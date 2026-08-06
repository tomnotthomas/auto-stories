import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { FairUseService } from './fair-use.service';
import { LimitsController } from './limits.controller';

const HOUR = 60 * 60 * 1000;

function configWith(values: Record<string, number> = {}): ConfigService {
  return {
    get: <T>(key: string, fallback: T): T => (values[key] as T) ?? fallback,
  } as unknown as ConfigService;
}

const asRequest = (ip: string): Request => ({ ip }) as Request;

describe('LimitsController', () => {
  let controller: LimitsController;
  let fairUse: FairUseService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LimitsController],
      providers: [
        FairUseService,
        {
          provide: ConfigService,
          useValue: configWith({ RATE_LIMIT_PER_HOUR: 5 }),
        },
      ],
    }).compile();
    controller = moduleRef.get(LimitsController);
    fairUse = moduleRef.get(FairUseService);
    fairUse.now = () => 3 * HOUR;
  });

  it('reports the full allowance to a caller who has not generated', () => {
    expect(controller.limits(asRequest('1.1.1.1'))).toEqual({
      remaining: 5,
      limit: 5,
      resetAt: new Date(4 * HOUR).toISOString(),
      dayExhausted: false,
    });
  });

  it('counts down as that caller generates', () => {
    fairUse.enforceIp('1.1.1.1');
    fairUse.enforceIp('1.1.1.1');

    expect(controller.limits(asRequest('1.1.1.1')).remaining).toBe(3);
  });

  it('keeps callers apart', () => {
    fairUse.enforceIp('1.1.1.1');
    fairUse.enforceIp('1.1.1.1');

    expect(controller.limits(asRequest('2.2.2.2')).remaining).toBe(5);
  });

  it('never costs the caller any of their allowance', () => {
    controller.limits(asRequest('1.1.1.1'));
    controller.limits(asRequest('1.1.1.1'));
    controller.limits(asRequest('1.1.1.1'));

    expect(controller.limits(asRequest('1.1.1.1')).remaining).toBe(5);
  });

  it('says when the allowance comes back', () => {
    expect(controller.limits(asRequest('1.1.1.1')).resetAt).toBe(
      new Date(4 * HOUR).toISOString(),
    );
  });

  it('flags the shared day being spent, and when it returns', () => {
    const spent = new FairUseService(configWith({ DAILY_GENERATION_CAP: 1 }));
    spent.now = () => 3 * HOUR;
    spent.consumeDailyBudget();
    const withSpentDay = new LimitsController(spent);

    const limits = withSpentDay.limits(asRequest('1.1.1.1'));

    expect(limits.dayExhausted).toBe(true);
    expect(limits.dayResetAt).toBe(new Date(24 * HOUR).toISOString());
  });

  it('leaves the day reset out while there is budget left', () => {
    expect(controller.limits(asRequest('1.1.1.1')).dayResetAt).toBeUndefined();
  });

  it('falls back to a shared bucket when the request has no ip', () => {
    expect(controller.limits({} as Request).remaining).toBe(5);
  });
  describe('limits configured from the environment', () => {
    /** Env vars arrive as strings; the contract promises integers. */
    const fromEnv = (values: Record<string, string>): LimitsController => {
      const service = new FairUseService({
        get: (key: string) => values[key],
      } as unknown as ConfigService);
      service.now = () => 3 * HOUR;
      return new LimitsController(service);
    };

    it('reports a number even when the limit was configured as a string', () => {
      const limits = fromEnv({ RATE_LIMIT_PER_HOUR: '3' }).limits(
        asRequest('1.1.1.1'),
      );

      expect(limits.limit).toBe(3);
      expect(typeof limits.limit).toBe('number');
      expect(typeof limits.remaining).toBe('number');
    });

    it('falls back rather than disabling the guard on nonsense', () => {
      for (const bad of ['', 'lots', '0', '-4']) {
        const limits = fromEnv({ RATE_LIMIT_PER_HOUR: bad }).limits(
          asRequest('1.1.1.1'),
        );
        expect(limits.limit).toBeGreaterThan(0);
      }
    });
  });
});
