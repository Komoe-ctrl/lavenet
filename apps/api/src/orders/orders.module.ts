import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OrdersRepository } from './orders.repository';

@Module({
  // AuthModule for JwtAuthGuard (needs AuthService injected, exported
  // alongside it from there -- see auth.module.ts). AgenciesModule for
  // AgenciesRepository (F-CMD-03: validating an agency id at pickup-mode
  // time, exported from there -- see agencies.module.ts).
  imports: [AuthModule, AgenciesModule],
  controllers: [CartController],
  providers: [CartService, OrdersRepository],
})
export class OrdersModule {}
