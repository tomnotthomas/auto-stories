import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { GenerateResponse } from '@auto-stories/api-types';
import { ApiErrors } from '../common/api-exception';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { sniffImageType } from './image.util';
import { StoryGeneratorService } from './story-generator.service';

/**
 * POST /api/v1/generate — the one core route (openapi/paths/generate.yaml).
 * The global ValidationPipe has already checked shape/count/size; here we do
 * the one content check it can't (is each photo really an image?) before
 * handing off to the model.
 */
@Controller('generate')
export class StoryController {
  constructor(private readonly generator: StoryGeneratorService) {}

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
    return this.generator.generate(request);
  }
}
