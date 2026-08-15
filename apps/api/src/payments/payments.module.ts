import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { SandboxMobileMoneyProvider } from './sandbox-mobile-money.provider';

@Module({
  providers: [
    PaymentsRepository,
    PaymentsService,
    { provide: PAYMENT_PROVIDER, useClass: SandboxMobileMoneyProvider },
  ],
  // PaymentsService exported for OrdersModule (OrdersController's new
  // POST /orders/:id/payment route) -- same shape as SlotsModule/
  // AgenciesModule/AddressesModule, all consumed by orders, never the
  // reverse.
  exports: [PaymentsService],
})
export class PaymentsModule {}
