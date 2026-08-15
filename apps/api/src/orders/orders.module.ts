import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { SlotsModule } from '../slots/slots.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  // AuthModule for JwtAuthGuard (needs AuthService injected, exported
  // alongside it from there -- see auth.module.ts). AgenciesModule for
  // AgenciesRepository (F-CMD-03: validating an agency id at pickup-mode
  // time). SlotsModule for SlotsRepository (F-CMD-04: validating a slot id
  // and computing the delivery minimum at slot-selection time).
  // AddressesModule for AddressesRepository (F-CMD-05: validating a
  // delivery address id). PaymentsModule for PaymentsService (F-PAY-01/02:
  // OrdersController's payment route). All exported from their own module
  // -- see agencies.module.ts/slots.module.ts/addresses.module.ts/
  // payments.module.ts.
  imports: [AuthModule, AgenciesModule, SlotsModule, AddressesModule, PaymentsModule],
  controllers: [CartController, OrdersController],
  providers: [CartService, CheckoutService, OrdersService, OrdersRepository],
  // OrdersRepository exported for AdminModule -- the admin orders module
  // reuses it rather than forking a second repository for the same table.
  exports: [OrdersRepository],
})
export class OrdersModule {}
