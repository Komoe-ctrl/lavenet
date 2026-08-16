import { Controller, Get, UseGuards } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminDashboardResponseDto } from './admin-dashboard.dto';
import { AdminDashboardService } from './admin-dashboard.service';

// F-ADM-01. ADMIN/STAFF only, same guard stack as AdminOrdersController --
// a plain 403 for a CLIENT token, no resource to hide behind a 404.
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @ZodResponse({ type: AdminDashboardResponseDto })
  get() {
    return this.adminDashboardService.get();
  }
}
