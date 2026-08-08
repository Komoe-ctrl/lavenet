import { Module } from '@nestjs/common';
import { SlotsController } from './slots.controller';
import { SlotsRepository } from './slots.repository';
import { SlotsService } from './slots.service';

@Module({
  controllers: [SlotsController],
  providers: [SlotsService, SlotsRepository],
  exports: [SlotsRepository],
})
export class SlotsModule {}
