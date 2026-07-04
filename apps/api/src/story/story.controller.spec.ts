import { Test } from '@nestjs/testing';
import type { GenerateResponse } from '@auto-stories/api-types';
import { ApiException } from '../common/api-exception';
import { FairUseService } from '../fair-use/fair-use.service';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { StoryController } from './story.controller';
import { StoryGeneratorService } from './story-generator.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');

function requestWith(b64s: string[]): GenerateRequestDto {
  return {
    story: 'a day at the beach',
    photos: b64s.map((b64, i) => ({ id: `p${i + 1}`, b64 })),
  };
}

describe('StoryController', () => {
  let controller: StoryController;
  let generate: jest.Mock;
  let consumeDailyBudget: jest.Mock;

  beforeEach(async () => {
    generate = jest.fn();
    consumeDailyBudget = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [StoryController],
      providers: [
        { provide: StoryGeneratorService, useValue: { generate } },
        { provide: FairUseService, useValue: { consumeDailyBudget } },
      ],
    }).compile();
    controller = moduleRef.get(StoryController);
  });

  it('delegates a valid request to the generator', async () => {
    const result: GenerateResponse = {
      frames: [{ photoId: 'p1', order: 1, caption: 'x' }],
      partial: false,
    };
    generate.mockResolvedValue(result);

    await expect(
      controller.generate(requestWith([JPEG, JPEG, JPEG])),
    ).resolves.toBe(result);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('reserves daily budget before calling the generator', async () => {
    generate.mockResolvedValue({ frames: [], partial: false });
    await controller.generate(requestWith([JPEG, JPEG, JPEG]));

    expect(consumeDailyBudget).toHaveBeenCalledTimes(1);
    expect(consumeDailyBudget.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0],
    );
  });

  it('rejects a non-image photo with invalid_request and never calls the model', () => {
    const bad = requestWith([JPEG, 'AAAA', JPEG]); // middle is not an image

    let caught: unknown;
    try {
      void controller.generate(bad);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiException);
    expect((caught as ApiException).code).toBe('invalid_request');
    expect(generate).not.toHaveBeenCalled();
    // A rejected upload must not burn the daily budget.
    expect(consumeDailyBudget).not.toHaveBeenCalled();
  });
});
