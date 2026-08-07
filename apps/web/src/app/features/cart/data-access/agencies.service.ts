import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import { agenciesControllerListAgencies } from '../../../core/api-client/functions';
import { AgenciesResponseDtoOutput } from '../../../core/api-client/models/agencies-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly. F-CMD-03: fetched once by the
// checkout tunnel to render the agency picker and, once chosen, its
// opening hours.
@Injectable({ providedIn: 'root' })
export class AgenciesService {
  private readonly api = inject(Api);

  listAgencies(): Promise<AgenciesResponseDtoOutput> {
    return this.api.invoke(agenciesControllerListAgencies);
  }
}
