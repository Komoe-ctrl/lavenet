// F-PAY-02/03. Every external payment gateway (a real Mobile Money
// aggregator, eventually -- Wave/Orange Money, V2 per CLAUDE.md §11)
// implements this. CLAUDE.md §11: no integration may require an API key to
// run the demo, so SandboxMobileMoneyProvider is the default -- and, for
// V1, the only -- binding (same interface/Sandbox-default shape as
// notifications/sms/sms-provider.interface.ts).
export interface PaymentProviderInitiateInput {
  paymentId: string;
  amountXof: number;
  idempotencyKey: string;
}

export interface PaymentProviderInitiateResult {
  providerRef: string;
}

export interface PaymentProviderPort {
  initiate(input: PaymentProviderInitiateInput): Promise<PaymentProviderInitiateResult>;

  // Verifies a webhook call actually came from this provider before
  // anything else runs (F-PAY-03) -- rawBody must be the exact bytes the
  // signature was computed over, not a re-serialized/parsed copy, so the
  // controller passes the raw request body, never req.body.
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;

  // Sandbox-only, optional: builds a callback body + signature identical in
  // shape to what this provider's real webhook would send, so the demo
  // trigger (POST /payments/:id/sandbox/simulate) exercises the exact same
  // verifyWebhookSignature path a genuine callback would have to pass --
  // never a second, unsigned code path. A real gateway integration has no
  // reason to implement this (it doesn't sign its own incoming callbacks),
  // hence optional rather than a required interface member.
  simulateWebhookCallback?(input: {
    idempotencyKey: string;
    outcome: 'PAID' | 'FAILED';
  }): { rawBody: string; signatureHeader: string };
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
