import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  ConfirmDeliveryDto,
  CourierActionResponseDto,
  CourierTourResponseDto,
  MarkClientAbsentDto,
} from './couriers.dto';
import { CouriersService } from './couriers.service';

// F-LIV-03/04/05. COURIER only -- a livreur never sees another livreur's
// tournée (CLAUDE.md: "un livreur ne voit que sa tournée"), enforced by
// CouriersService scoping every query/mutation to the caller's own id, not
// just by this role gate.
@Controller('couriers/deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COURIER')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Get()
  @ZodResponse({ type: CourierTourResponseDto })
  tour(@CurrentUser() courierId: string) {
    return this.couriersService.tour(courierId);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ZodResponse({ type: CourierActionResponseDto })
  confirm(
    @CurrentUser() courierId: string,
    @Param('id') id: string,
    @Body() body: ConfirmDeliveryDto,
  ) {
    return this.couriersService.confirm(id, courierId, body.otpCode);
  }

  @Post(':id/absent')
  @HttpCode(200)
  @ZodResponse({ type: CourierActionResponseDto })
  markAbsent(
    @CurrentUser() courierId: string,
    @Param('id') id: string,
    @Body() body: MarkClientAbsentDto,
  ) {
    return this.couriersService.markAbsent(id, courierId, body.reason, body.newDeliverySlotId);
  }
}
