import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { AuthModule } from '../auth/auth.module';
import { SlotsModule } from '../slots/slots.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OrdersRepository } from './orders.repository';

@Module({
  // AuthModule for JwtAuthGuard (needs AuthService injected, exported
  // alongside it from there -- see auth.module.ts). AgenciesModule for
  // AgenciesRepository (F-CMD-03: validating an agency id at pickup-mode
  // time). SlotsModule for SlotsRepository (F-CMD-04: validating a slot id
  // and computing the delivery minimum at slot-selection time). Both
  // exported from their own module -- see agencies.module.ts/slots.module.ts.
  imports: [AuthModule, AgenciesModule, SlotsModule],
  controllers: [CartController],
  providers: [CartService, OrdersRepository],
})
export class OrdersModule {}
