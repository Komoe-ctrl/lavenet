import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';

// F-ADM. Home for every back-office surface -- orders today (F-ADM-02),
// clients/tariffs/slots/couriers/promo codes/CSV export/audit log in later
// lots, all ADMIN/STAFF-guarded the same way (see AdminOrdersController).
@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
})
export class AdminModule {}
