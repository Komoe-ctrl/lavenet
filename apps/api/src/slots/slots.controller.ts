import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { SlotsResponseDto } from './slots.dto';
import { SlotsService } from './slots.service';

// Public: no guard. Reference data (upcoming windows, capacity), no more
// sensitive than the catalog or the agency list -- the checkout tunnel
// fetches it once to render the F-CMD-04 slot pickers.
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  @ZodResponse({ type: SlotsResponseDto })
  listSlots() {
    return this.slotsService.listSlots();
  }
}
