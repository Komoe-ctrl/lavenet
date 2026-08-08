import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import { slotsControllerListSlots } from '../../../core/api-client/functions';
import { SlotsResponseDtoOutput } from '../../../core/api-client/models/slots-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly. F-CMD-04: fetched once by the
// checkout tunnel to render the pickup/delivery slot pickers.
@Injectable({ providedIn: 'root' })
export class SlotsService {
  private readonly api = inject(Api);

  listSlots(): Promise<SlotsResponseDtoOutput> {
    return this.api.invoke(slotsControllerListSlots);
  }
}
