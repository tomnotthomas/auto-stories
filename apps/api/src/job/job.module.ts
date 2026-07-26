import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';

/**
 * Owns the async-job surface: the in-memory {@link JobService} and the status +
 * SSE {@link JobController}. Exports the service so StoryModule can enqueue.
 */
@Module({
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
