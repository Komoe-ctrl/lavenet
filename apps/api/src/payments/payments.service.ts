import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Payment as PaymentRecord } from '@prisma/client';
import type { CreatePaymentResponse, PaymentProviderValue } from '@lavenet/shared-schemas';
import { env } from '../config/env';
import { PAYMENT_PROVIDER, PaymentProviderPort } from './payment-provider.interface';
import { PaymentsRepository } from './payments.repository';
import { webhookPayloadSchema } from './payments.dto';

// A placed order that hasn't reached a terminal state yet -- DRAFT (still a
// cart) and CANCELLED/DELIVERED (nothing left to collect) can't accept a
// new payment.
const PAYABLE_STATUSES = new Set([
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'ON_HOLD',
]);

// F-PAY-01/02/06.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProviderPort,
  ) {}

  // Same 404-either-way ownership pattern as OrdersService.detail
  // (CLAUDE.md §5, IDOR) -- "doesn't exist", "belongs to someone else" and
  // "still a DRAFT" are indistinguishable to the caller.
  async initiate(
    userId: string,
    orderId: string,
    provider: PaymentProviderValue,
  ): Promise<CreatePaymentResponse> {
    const order = await this.repo.findOrderForPayment(orderId);
    if (!order || order.userId !== userId || order.status === 'DRAFT') {
      throw new NotFoundException('Commande introuvable.');
    }
    if (!PAYABLE_STATUSES.has(order.status)) {
      throw new BadRequestException('Cette commande ne peut plus recevoir de paiement.');
    }

    const existing = await this.repo.findByOrderId(orderId);
    if (existing) {
      throw new BadRequestException('Un paiement existe déjà pour cette commande.');
    }

    // CLAUDE.md §4 rule 6: amountXof is order.totalXof, read fresh from the
    // DB row above -- never accepted from the request body, which doesn't
    // even carry one (createPaymentInputSchema is provider-only).
    const amountXof = order.totalXof as number;
    const id = randomUUID();
    const idempotencyKey = randomUUID();

    let providerRef: string | null = null;
    if (provider === 'MOBILE_MONEY') {
      const result = await this.paymentProvider.initiate({ paymentId: id, amountXof, idempotencyKey });
      providerRef = result.providerRef;
    }

    const payment = await this.repo.create({
      id,
      orderId,
      provider,
      amountXof,
      idempotencyKey,
      providerRef,
    });
    return { payment: toPaymentDto(payment) };
  }

  // F-PAY-03. Order matters: the signature is checked against the raw
  // bytes before anything else runs, including parsing the payload as
  // JSON -- an unsigned or forged request never reaches the database, or
  // even gets its shape validated.
  async handleWebhook(rawBody: string, signatureHeader: string | undefined): Promise<void> {
    if (!this.paymentProvider.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new UnauthorizedException('Signature invalide.');
    }

    const parsed = webhookPayloadSchema.safeParse(safeJsonParse(rawBody));
    if (!parsed.success) {
      throw new BadRequestException('Payload de webhook invalide.');
    }
    const payload = parsed.data;

    const payment = await this.repo.findByIdempotencyKey(payload.idempotencyKey);
    if (!payment) {
      throw new NotFoundException('Paiement introuvable.');
    }
    if (payment.status !== 'PENDING') {
      // Replay of an already-resolved callback (or two concurrent
      // deliveries of the same event): idempotencyKey's whole reason for
      // existing is that this is a no-op, not a second write.
      return;
    }

    await this.repo.settleFromWebhook(payment.id, payload.status);
  }

  // Demo-only trigger for POST /payments/:id/sandbox/simulate. Builds a
  // genuinely signed payload via the provider (SandboxMobileMoneyProvider's
  // simulateWebhookCallback) and hands it to the exact same handleWebhook
  // above -- there is no second, unverified path to PAID/FAILED.
  async simulateWebhook(paymentId: string, outcome: 'PAID' | 'FAILED'): Promise<void> {
    if (!env.DEMO_MODE) {
      throw new NotFoundException();
    }
    const payment = await this.repo.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Paiement introuvable.');
    }
    if (!this.paymentProvider.simulateWebhookCallback) {
      throw new NotFoundException();
    }

    const { rawBody, signatureHeader } = this.paymentProvider.simulateWebhookCallback({
      idempotencyKey: payment.idempotencyKey,
      outcome,
    });
    await this.handleWebhook(rawBody, signatureHeader);
  }
}

function safeJsonParse(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
}

function toPaymentDto(payment: PaymentRecord): CreatePaymentResponse['payment'] {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    status: payment.status,
    amountXof: payment.amountXof,
    createdAt: payment.createdAt.toISOString(),
  };
}
