import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListOrdersQueryDto, OrderDetailResponseDto, OrderListResponseDto } from './orders.dto';
import { OrdersService } from './orders.service';

// F-CMD-09. Every route scoped to the current token's user, no :userId in
// any URL -- same convention as CartController. Deliberately separate from
// CartController: this is about placed orders (F-CMD-09/F-STA), not the
// DRAFT cart CartService/CheckoutService own.
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ZodResponse({ type: OrderListResponseDto })
  list(@CurrentUser() userId: string, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(userId, query.status);
  }

  @Get(':id')
  @ZodResponse({ type: OrderDetailResponseDto })
  detail(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.ordersService.detail(userId, id);
  }

  // F-CMD-08.
  @Post(':id/cancel')
  @HttpCode(200)
  @ZodResponse({ type: OrderDetailResponseDto })
  cancel(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.ordersService.cancel(userId, id);
  }
}
