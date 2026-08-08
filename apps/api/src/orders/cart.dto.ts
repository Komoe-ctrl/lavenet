import { createZodDto } from 'nestjs-zod';
import {
  addCartItemSchema,
  cartResponseSchema,
  checkoutResponseSchema,
  setDeliveryAddressSchema,
  setPickupModeSchema,
  setSlotsSchema,
  updateCartItemSchema,
} from '@lavenet/shared-schemas';

export class AddCartItemDto extends createZodDto(addCartItemSchema) {}
export class UpdateCartItemDto extends createZodDto(updateCartItemSchema) {}
export class CartResponseDto extends createZodDto(cartResponseSchema) {}
export class SetSlotsDto extends createZodDto(setSlotsSchema) {}
export class SetDeliveryAddressDto extends createZodDto(setDeliveryAddressSchema) {}
export class CheckoutResponseDto extends createZodDto(checkoutResponseSchema) {}

// Not `class ... extends createZodDto(...)`, unlike the DTOs above: a
// discriminated union's parsed type is a union, and TS refuses to extend a
// base class whose constructor return type isn't a single object type.
// The plain const+type alias is just as valid a Nest DTO -- createZodDto
// already returns a full constructable class, extending it is only ever a
// style choice for object schemas. createZodDto's returned class is always
// internally named "AugmentedZodDto" (its swagger/generated-client schema
// name too) unless renamed like this -- without it, this DTO would
// silently collide with the next non-subclassable (union) DTO a later
// increment adds, each overwriting the other's generated TS type.
export const SetPickupModeDto = createZodDto(setPickupModeSchema);
Object.defineProperty(SetPickupModeDto, 'name', { value: 'SetPickupModeDto' });
export type SetPickupModeDto = InstanceType<typeof SetPickupModeDto>;
