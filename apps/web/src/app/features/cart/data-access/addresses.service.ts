import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import { addressesControllerList } from '../../../core/api-client/functions';
import { ListAddressesResponseDtoOutput } from '../../../core/api-client/models/list-addresses-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly. A separate wrapper from
// features/account's own AddressesService, not a shared import -- §3's
// architecture rule forbids features/X importing features/Y/data-access
// directly. F-CMD-05: fetched once by the checkout tunnel to render the
// delivery-address picker.
@Injectable({ providedIn: 'root' })
export class AddressesService {
  private readonly api = inject(Api);

  list(): Promise<ListAddressesResponseDtoOutput> {
    return this.api.invoke(addressesControllerList);
  }
}
