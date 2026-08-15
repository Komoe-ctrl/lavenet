import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';
import {
  PaymentProviderInitiateInput,
  PaymentProviderInitiateResult,
  PaymentProviderPort,
} from './payment-provider.interface';

// Simulated gateway: no network call, no real Mobile Money account
// involved (CLAUDE.md §11) -- initiate() only records a fake reference.
// Resolution (PAID/FAILED) happens the same way a real provider's would:
// a signed POST to POST /payments/webhook, verified by
// verifyWebhookSignature below. In demo mode that POST is triggered by a
// dedicated sandbox endpoint (increment 3) rather than a real gateway, but
// it goes through the *same* webhook handler and the *same* signature
// check -- there is no shortcut that bypasses verification.
@Injectable()
export class SandboxMobileMoneyProvider implements PaymentProviderPort {
  private readonly logger = new Logger(SandboxMobileMoneyProvider.name);

  async initiate(
    input: PaymentProviderInitiateInput,
  ): Promise<PaymentProviderInitiateResult> {
    const providerRef = `sandbox_${input.paymentId}`;
    if (env.DEMO_MODE) {
      this.logger.log(
        `[DEMO] Mobile Money initiated: payment=${input.paymentId} amount=${input.amountXof} ref=${providerRef}`,
      );
    }
    return { providerRef };
  }

  // HMAC-SHA256 over the raw body, hex-encoded -- signAndSend below (used
  // by the sandbox simulate endpoint) computes it the same way, so the
  // webhook handler exercises the exact same comparison a real provider's
  // callback would have to pass.
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) {
      return false;
    }
    const expected = this.sign(rawBody);
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signatureHeader, 'hex');
    // timingSafeEqual throws on a length mismatch rather than returning
    // false -- an attacker-controlled header must never crash the request
    // instead of just failing verification.
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  sign(rawBody: string): string {
    return createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
  }

  // Same JSON shape and same sign() the real webhook handler verifies
  // against -- PaymentsService.simulateWebhook hands the result straight to
  // handleWebhook, so this only ever supplies the payload, it never
  // touches the verification itself.
  simulateWebhookCallback(input: {
    idempotencyKey: string;
    outcome: 'PAID' | 'FAILED';
  }): { rawBody: string; signatureHeader: string } {
    const rawBody = JSON.stringify({ idempotencyKey: input.idempotencyKey, status: input.outcome });
    return { rawBody, signatureHeader: this.sign(rawBody) };
  }
}
