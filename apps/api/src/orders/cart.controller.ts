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
import { AddCartItemDto, CartResponseDto, UpdateCartItemDto } from './cart.dto';
import { CartService } from './cart.service';

// Every route scoped to the current token's user, no :userId in any URL.
// Item ownership (via the item's parent order) is checked in the service
// (CartService.assertOwnedDraftItem), not here (CLAUDE.md §5).
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

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
}
