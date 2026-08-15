import { Body, Controller, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SimulatePaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

// F-PAY-03. No JwtAuthGuard on this controller: a payment gateway's
// callback carries no user session -- its HMAC signature *is* the
// authentication, verified first thing inside PaymentsService.handleWebhook,
// before any database access.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature?: string,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    await this.paymentsService.handleWebhook(rawBody, signature);
    return { received: true };
  }

  // Demo-only (guarded inside the service by DEMO_MODE): the closest thing
  // to a real Mobile Money confirmation this sandbox can offer, without a
  // real gateway or API key (CLAUDE.md §11).
  @Post(':id/sandbox/simulate')
  @HttpCode(200)
  async simulate(
    @Param('id') paymentId: string,
    @Body() body: SimulatePaymentDto,
  ): Promise<{ simulated: true }> {
    await this.paymentsService.simulateWebhook(paymentId, body.outcome);
    return { simulated: true };
  }
}
