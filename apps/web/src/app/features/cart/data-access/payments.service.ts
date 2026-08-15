import { Injectable, inject } from '@angular/core';
import { Api } from '../../../core/api-client/api';
import { ordersControllerInitiatePayment, paymentsControllerSimulate } from '../../../core/api-client/functions';
import { CreatePaymentResponseDtoOutput } from '../../../core/api-client/models/create-payment-response-dto-output';

export type PaymentProviderChoice = 'CASH' | 'MOBILE_MONEY';
export type Payment = CreatePaymentResponseDtoOutput['payment'];

// Thin wrapper around the generated client, per CLAUDE.md §3: components
// never call the API client directly.
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly api = inject(Api);

  initiate(orderId: string, provider: PaymentProviderChoice): Promise<{ payment: Payment }> {
    return this.api.invoke(ordersControllerInitiatePayment, { id: orderId, body: { provider } });
  }

  // Demo-only trigger (F-PAY-03): the API itself gates this on DEMO_MODE
  // and rejects it otherwise, this call never bypasses that.
  simulate(paymentId: string, outcome: 'PAID' | 'FAILED'): Promise<void> {
    return this.api.invoke(paymentsControllerSimulate, { id: paymentId, body: { outcome } });
  }
}
