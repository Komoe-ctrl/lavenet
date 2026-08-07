import { createZodDto } from 'nestjs-zod';
import {
  addCartItemSchema,
  cartResponseSchema,
  updateCartItemSchema,
} from '@lavenet/shared-schemas';

export class AddCartItemDto extends createZodDto(addCartItemSchema) {}
export class UpdateCartItemDto extends createZodDto(updateCartItemSchema) {}
export class CartResponseDto extends createZodDto(cartResponseSchema) {}
