import { Module } from '@nestjs/common';
import { FairUseGuard } from '../fair-use/fair-use.guard';
import { FairUseService } from '../fair-use/fair-use.service';
import { JobModule } from '../job/job.module';
import { genaiProvider } from './genai.provider';
import { LayoutAgentService } from './layout-agent.service';
import { StoryController } from './story.controller';
import { StoryGeneratorService } from './story-generator.service';

@Module({
  imports: [JobModule],
  controllers: [StoryController],
  providers: [
    genaiProvider,
    StoryGeneratorService,
    LayoutAgentService,
    FairUseService,
    FairUseGuard,
  ],
})
export class StoryModule {}
