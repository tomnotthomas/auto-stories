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

    const jobId = this.jobs.enqueue(async (report) => {
      // The budget is reserved inside the generator, immediately before each
      // model call — that is the unit the provider counts, and it makes a
      // safety retry cost what it actually costs (decision 7.37).
      // The reporter carries each frame the model finishes out to the waiting
      // client over the job's SSE stream (decision 7.30).
      return this.generator.generate(request, report);
    });
    return { jobId };
  }
}
