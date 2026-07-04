import { Module } from '@nestjs/common';
import { genaiProvider } from './genai.provider';
import { StoryController } from './story.controller';
import { StoryGeneratorService } from './story-generator.service';

@Module({
  controllers: [StoryController],
  providers: [genaiProvider, StoryGeneratorService],
})
export class StoryModule {}
