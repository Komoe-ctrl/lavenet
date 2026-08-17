import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';

@Module({
  imports: [AuthModule, OrdersModule, AdminModule],
  controllers: [CouriersController],
  providers: [CouriersService],
})
export class CouriersModule {}
