import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { OtpModule } from '../otp/otp.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardRepository } from './admin-dashboard.repository';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminExportController } from './admin-export.controller';
import { AdminExportRepository } from './admin-export.repository';
import { AdminExportService } from './admin-export.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';

// F-ADM. Home for every back-office surface -- orders (F-ADM-02), dashboard
// (F-ADM-01) and CSV export (F-ADM-08) today, clients/tariffs/slots/
// couriers/promo codes/audit log in later lots, all ADMIN/STAFF-guarded
// the same way (see AdminOrdersController).
@Module({
  imports: [AuthModule, OrdersModule, OtpModule, NotificationsModule],
  controllers: [AdminOrdersController, AdminDashboardController, AdminExportController],
  providers: [
    AdminOrdersService,
    AdminDashboardService,
    AdminDashboardRepository,
    AdminExportService,
    AdminExportRepository,
  ],
  // AdminOrdersService exported for CouriersModule (F-LIV-04): a courier
  // confirming delivery reuses the exact same OTP-gated DELIVERED
  // transition a staff member's back-office override goes through, rather
  // than a second implementation of it.
  exports: [AdminOrdersService],
})
export class AdminModule {}
