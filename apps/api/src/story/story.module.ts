import { Module } from '@nestjs/common';
import { FairUseGuard } from '../fair-use/fair-use.guard';
import { FairUseService } from '../fair-use/fair-use.service';
import { genaiProvider } from './genai.provider';
import { StoryController } from './story.controller';
import { StoryGeneratorService } from './story-generator.service';

@Module({
  controllers: [StoryController],
  providers: [
    genaiProvider,
    StoryGeneratorService,
    FairUseService,
    FairUseGuard,
  ],
})
export class StoryModule {}
