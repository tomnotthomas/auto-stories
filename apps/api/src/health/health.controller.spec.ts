import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('reports a healthy status', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
