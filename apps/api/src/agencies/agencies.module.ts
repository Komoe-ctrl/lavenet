import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgenciesRepository } from './agencies.repository';
import { AgenciesService } from './agencies.service';

@Module({
  controllers: [AgenciesController],
  providers: [AgenciesService, AgenciesRepository],
  exports: [AgenciesRepository],
})
export class AgenciesModule {}
