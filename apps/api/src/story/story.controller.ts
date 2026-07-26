import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { GenerateAccepted } from '@auto-stories/api-types';
import { ApiErrors } from '../common/api-exception';
import { FairUseGuard } from '../fair-use/fair-use.guard';
import { FairUseService } from '../fair-use/fair-use.service';
import { JobService } from '../job/job.service';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { sniffImageType } from './image.util';
import { StoryGeneratorService } from './story-generator.service';

/**
 * POST /api/v1/generate — the one core route (openapi/paths/generate.yaml).
 * The global ValidationPipe has already checked shape/count/size; the
 * FairUseGuard has already applied the per-IP limit. Here we do the one content
 * check the pipe can't (is each photo really an image?), then enqueue the
 * generation as a background job and return 202 { jobId } at once — a 30-photo
 * run can't hold the HTTP request open past Render's timeout (architecture 6.1).
 * The finished story arrives over GET /api/v1/jobs/:id/events (SSE).
 */
@UseGuards(FairUseGuard)
@Controller('generate')
export class StoryController {
  constructor(
    private readonly generator: StoryGeneratorService,
    private readonly fairUse: FairUseService,
    private readonly jobs: JobService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  generate(@Body() request: GenerateRequestDto): GenerateAccepted {
    for (const photo of request.photos) {
      if (sniffImageType(photo.b64) === null) {
        throw ApiErrors.invalidRequest(
          'Only JPEG, PNG, WebP, or HEIC images are accepted.',
        );
      }
    }

    const jobId = this.jobs.enqueue(async () => {
      // Reserve the daily budget only when the job actually runs, so a queued
      // job that never runs never spends it; a rejected upload never reaches
      // here, so it never burns the budget either.
      this.fairUse.consumeDailyBudget();
      return this.generator.generate(request);
    });
    return { jobId };
  }
}
