import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { AgenciesResponseDto } from './agencies.dto';
import { AgenciesService } from './agencies.service';

// Public: no guard. Reference data (name/address/opening hours), no more
// sensitive than the catalog -- the checkout tunnel fetches it once to
// render the F-CMD-03 agency picker.
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  @ZodResponse({ type: AgenciesResponseDto })
  listAgencies() {
    return this.agenciesService.listAgencies();
  }
}
