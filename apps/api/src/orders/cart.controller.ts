import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AddCartItemDto,
  CartResponseDto,
  CheckoutResponseDto,
  SetDeliveryAddressDto,
  SetPickupModeDto,
  SetSlotsDto,
  UpdateCartItemDto,
} from './cart.dto';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';

// Every route scoped to the current token's user, no :userId in any URL.
// Item ownership (via the item's parent order) is checked in the service
// (CartService.assertOwnedDraftItem), not here (CLAUDE.md §5).
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Get()
  @ZodResponse({ type: CartResponseDto })
  getCart(@CurrentUser() userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @ZodResponse({ type: CartResponseDto })
  addItem(@CurrentUser() userId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(userId, dto);
  }

  // Returns the updated cart (not 204): the caller needs fresh totals
  // immediately after every mutation, not a second round trip.
  @Patch('items/:id')
  @HttpCode(200)
  @ZodResponse({ type: CartResponseDto })
  updateItem(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, id, dto);
  }

  @Delete('items/:id')
  @HttpCode(200)
  @ZodResponse({ type: CartResponseDto })
  removeItem(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.cartService.removeItem(userId, id);
  }

  @Delete()
  @HttpCode(200)
  @ZodResponse({ type: CartResponseDto })
  clearCart(@CurrentUser() userId: string) {
    return this.cartService.clearCart(userId);
  }

  // F-CMD-03. Body shape enforced by the shared discriminated union
  // (HOME vs AGENCY) before it ever reaches the service.
  @Patch('pickup')
  @HttpCode(200)
  @ZodResponse({ type: CartResponseDto })
  setPickupMode(@CurrentUser() userId: string, @Body() dto: SetPickupModeDto) {
    return this.cartService.setPickupMode(userId, dto);
  }

  // F-CMD-04. Business validation (pickup mode required first, HOME vs
  // AGENCY consistency, the min-delivery rule) lives in the service --
  // this DTO only enforces shape.
  @Patch('slots')
  @HttpCode(200)
  @ZodResponse({ type: CartResponseDto })
  setSlots(@CurrentUser() userId: string, @Body() dto: SetSlotsDto) {
    return this.cartService.setSlots(userId, dto);
  }

  // F-CMD-05. Sets the delivery-address *preference* -- checkout is what
  // copies it onto the order as a frozen snapshot.
  @Patch('address')
  @HttpCode(200)
  @ZodResponse({ type: CartResponseDto })
  setDeliveryAddress(@CurrentUser() userId: string, @Body() dto: SetDeliveryAddressDto) {
    return this.cartService.setDeliveryAddress(userId, dto);
  }

  // F-CMD-05/07. The DRAFT -> PENDING_PICKUP transition: every
  // precondition is re-validated from scratch server-side (business
  // validation lives in CheckoutService, never here or on the client).
  @Post('checkout')
  @HttpCode(200)
  @ZodResponse({ type: CheckoutResponseDto })
  checkout(@CurrentUser() userId: string) {
    return this.checkoutService.checkout(userId);
  }
}
