import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

@Module({
  // AuthModule for JwtAuthGuard (needs AuthService injected) -- same
  // requirement as every other guarded controller (orders.module.ts etc.).
  imports: [AuthModule],
  controllers: [InvoicesController],
  providers: [InvoicesRepository, InvoicesService],
})
export class InvoicesModule {}
