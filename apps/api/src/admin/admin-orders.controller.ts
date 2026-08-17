import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminCourierListResponseDto,
  AdminListOrdersQueryDto,
  AdminOrderDetailResponseDto,
  AdminOrderListResponseDto,
  AdminUpdateOrderStatusDto,
  AdminUpdateOrderStatusResponseDto,
  AssignCourierDto,
} from './admin-orders.dto';
import { AdminOrdersService } from './admin-orders.service';

// F-ADM-02. ADMIN/STAFF only -- a CLIENT hitting any of these routes gets a
// plain 403 from RolesGuard, not the 404-either-way IDOR convention used
// for ownership (there's no resource existence to hide here, just access
// to a section of the app).
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @ZodResponse({ type: AdminOrderListResponseDto })
  list(@Query() query: AdminListOrdersQueryDto) {
    return this.adminOrdersService.list(query);
  }

  // F-LIV-02. Declared before @Get(':id') -- 'couriers' would otherwise be
  // swallowed as an :id value, matching this literal route instead only
  // because Nest resolves routes in declaration order.
  @Get('couriers')
  @ZodResponse({ type: AdminCourierListResponseDto })
  listCouriers() {
    return this.adminOrdersService.listCouriers();
  }

  @Get(':id')
  @ZodResponse({ type: AdminOrderDetailResponseDto })
  detail(@Param('id') id: string) {
    return this.adminOrdersService.detail(id);
  }

  @Patch(':id/status')
  @ZodResponse({ type: AdminUpdateOrderStatusResponseDto })
  updateStatus(
    @CurrentUser() actorId: string,
    @Param('id') id: string,
    @Body() body: AdminUpdateOrderStatusDto,
  ) {
    return this.adminOrdersService.updateStatus(
      id,
      actorId,
      body.toStatus,
      body.reason,
      body.otpCode,
    );
  }

  // F-LIV-02.
  @Patch(':id/courier')
  @ZodResponse({ type: AdminOrderDetailResponseDto })
  assignCourier(@Param('id') id: string, @Body() body: AssignCourierDto) {
    return this.adminOrdersService.assignCourier(id, body.courierId);
  }
}
