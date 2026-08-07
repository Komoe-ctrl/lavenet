import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OrdersRepository } from './orders.repository';

@Module({
  // AuthModule for JwtAuthGuard (needs AuthService injected, exported
  // alongside it from there -- see auth.module.ts).
  imports: [AuthModule],
  controllers: [CartController],
  providers: [CartService, OrdersRepository],
})
export class OrdersModule {}
