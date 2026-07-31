import { Test } from '@nestjs/testing';
import type { GenerateResponse } from '@auto-stories/api-types';
import { ApiException, ApiErrors } from '../common/api-exception';
import { FairUseService } from '../fair-use/fair-use.service';
import { JobService } from '../job/job.service';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { StoryController } from './story.controller';
import { StoryGeneratorService } from './story-generator.service';
import { DEFAULT_STYLE } from './caption-style';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');
const tick = () => new Promise((r) => setTimeout(r, 0));

const STORY: GenerateResponse = {
  frames: [{ photoId: 'p1', order: 1, caption: 'x', style: DEFAULT_STYLE }],
  partial: false,
};

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
  let jobs: JobService;

  beforeEach(async () => {
    generate = jest.fn();
    consumeDailyBudget = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [StoryController],
      providers: [
        { provide: StoryGeneratorService, useValue: { generate } },
        { provide: FairUseService, useValue: { consumeDailyBudget } },
        JobService,
      ],
    }).compile();
    controller = moduleRef.get(StoryController);
    jobs = moduleRef.get(JobService);
  });

  it('accepts a valid request and returns a jobId; the story is produced in the job', async () => {
    generate.mockResolvedValue(STORY);

    const accepted = controller.generate(requestWith([JPEG, JPEG, JPEG]));
    expect(accepted).toEqual({ jobId: expect.any(String) });

    await tick();
    expect(jobs.get(accepted.jobId)).toEqual({ status: 'done', result: STORY });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('reserves the daily budget before calling the generator, inside the job', async () => {
    generate.mockResolvedValue(STORY);

    const { jobId } = controller.generate(requestWith([JPEG, JPEG, JPEG]));
    await tick();

    expect(consumeDailyBudget).toHaveBeenCalledTimes(1);
    expect(consumeDailyBudget.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0],
    );
    expect(jobs.get(jobId)?.status).toBe('done');
  });

  it('fails the job with quota_exhausted when the budget is spent, without calling the model', async () => {
    consumeDailyBudget.mockImplementation(() => {
      throw ApiErrors.quotaExhausted();
    });

    const { jobId } = controller.generate(requestWith([JPEG, JPEG, JPEG]));
    await tick();

    expect(generate).not.toHaveBeenCalled();
    expect(jobs.get(jobId)).toMatchObject({
      status: 'failed',
      error: { code: 'quota_exhausted' },
    });
  });

  it('rejects a non-image photo synchronously and never enqueues or bills', () => {
    const bad = requestWith([JPEG, 'AAAA', JPEG]); // middle is not an image

    let caught: unknown;
    try {
      controller.generate(bad);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiException);
    expect((caught as ApiException).code).toBe('invalid_request');
    expect(generate).not.toHaveBeenCalled();
    expect(consumeDailyBudget).not.toHaveBeenCalled();
  });
});
