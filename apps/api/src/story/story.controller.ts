import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { GenerateResponse } from '@auto-stories/api-types';
import { ApiErrors } from '../common/api-exception';
import { FairUseGuard } from '../fair-use/fair-use.guard';
import { FairUseService } from '../fair-use/fair-use.service';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { sniffImageType } from './image.util';
import { StoryGeneratorService } from './story-generator.service';

/**
 * POST /api/v1/generate — the one core route (openapi/paths/generate.yaml).
 * The global ValidationPipe has already checked shape/count/size; the
 * FairUseGuard has already applied the per-IP limit. Here we do the one
 * content check the pipe can't (is each photo really an image?), reserve a
 * slot of the global daily budget, then hand off to the model.
 */
@UseGuards(FairUseGuard)
@Controller('generate')
export class StoryController {
  constructor(
    private readonly generator: StoryGeneratorService,
    private readonly fairUse: FairUseService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  generate(@Body() request: GenerateRequestDto): Promise<GenerateResponse> {
    for (const photo of request.photos) {
      if (sniffImageType(photo.b64) === null) {
        throw ApiErrors.invalidRequest(
          'Only JPEG, PNG, WebP, or HEIC images are accepted.',
        );
      }
    }
    // Only well-formed, real-image requests count against the daily Gemini
    // budget — a rejected upload never burns it.
    this.fairUse.consumeDailyBudget();
    return this.generator.generate(request);
  }
}
