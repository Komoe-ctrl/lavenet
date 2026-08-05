import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import {
  addressesControllerCreate,
  addressesControllerList,
  addressesControllerRemove,
  addressesControllerUpdate,
} from '../../../core/api-client/functions';
import { CreateAddressDto } from '../../../core/api-client/models/create-address-dto';
import { CreateAddressResponseDtoOutput } from '../../../core/api-client/models/create-address-response-dto-output';
import { ListAddressesResponseDtoOutput } from '../../../core/api-client/models/list-addresses-response-dto-output';
import { UpdateAddressDto } from '../../../core/api-client/models/update-address-dto';
import { UpdateAddressResponseDtoOutput } from '../../../core/api-client/models/update-address-response-dto-output';

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly.
@Injectable({ providedIn: 'root' })
export class AddressesService {
  private readonly api = inject(Api);

  list(): Promise<ListAddressesResponseDtoOutput> {
    return this.api.invoke(addressesControllerList);
  }

  create(body: CreateAddressDto): Promise<CreateAddressResponseDtoOutput> {
    return this.api.invoke(addressesControllerCreate, { body });
  }

  update(id: string, body: UpdateAddressDto): Promise<UpdateAddressResponseDtoOutput> {
    return this.api.invoke(addressesControllerUpdate, { id, body });
  }

  remove(id: string): Promise<void> {
    return this.api.invoke(addressesControllerRemove, { id });
  }
}
