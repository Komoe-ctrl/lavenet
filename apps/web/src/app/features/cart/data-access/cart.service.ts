import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import {
  cartControllerAddItem,
  cartControllerCheckout,
  cartControllerClearCart,
  cartControllerGetCart,
  cartControllerRemoveItem,
  cartControllerSetDeliveryAddress,
  cartControllerSetPickupMode,
  cartControllerSetSlots,
  cartControllerUpdateItem,
} from '../../../core/api-client/functions';
import { AddCartItemDto } from '../../../core/api-client/models/add-cart-item-dto';
import { CartResponseDtoOutput } from '../../../core/api-client/models/cart-response-dto-output';
import { CheckoutResponseDtoOutput } from '../../../core/api-client/models/checkout-response-dto-output';
import { SetDeliveryAddressDto } from '../../../core/api-client/models/set-delivery-address-dto';
import { SetPickupModeDto } from '../../../core/api-client/models/set-pickup-mode-dto';
import { SetSlotsDto } from '../../../core/api-client/models/set-slots-dto';
import { UpdateCartItemDto } from '../../../core/api-client/models/update-cart-item-dto';

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly.
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(Api);

  getCart(): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerGetCart);
  }

  addItem(body: AddCartItemDto): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerAddItem, { body });
  }

  updateItem(id: string, body: UpdateCartItemDto): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerUpdateItem, { id, body });
  }

  removeItem(id: string): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerRemoveItem, { id });
  }

  clearCart(): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerClearCart);
  }

  setPickupMode(body: SetPickupModeDto): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerSetPickupMode, { body });
  }

  setSlots(body: SetSlotsDto): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerSetSlots, { body });
  }

  setDeliveryAddress(body: SetDeliveryAddressDto): Promise<CartResponseDtoOutput> {
    return this.api.invoke(cartControllerSetDeliveryAddress, { body });
  }

  checkout(): Promise<CheckoutResponseDtoOutput> {
    return this.api.invoke(cartControllerCheckout);
  }
}
