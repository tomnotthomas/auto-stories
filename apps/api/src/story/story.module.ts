import { Module } from '@nestjs/common';
import { FairUseGuard } from '../fair-use/fair-use.guard';
import { FairUseService } from '../fair-use/fair-use.service';
import { LimitsController } from '../fair-use/limits.controller';
import { JobModule } from '../job/job.module';
import { genaiProvider } from './genai.provider';
import { StoryController } from './story.controller';
import { StoryGeneratorService } from './story-generator.service';

@Module({
  imports: [JobModule],
  // LimitsController lives here so it shares this module's FairUseService
  // instance — what it reports has to be what the guard enforces.
  controllers: [StoryController, LimitsController],
  providers: [
    genaiProvider,
    StoryGeneratorService,
    FairUseService,
    FairUseGuard,
  ],
})
export class StoryModule {}
