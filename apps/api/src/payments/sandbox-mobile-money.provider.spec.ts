import { SandboxMobileMoneyProvider } from './sandbox-mobile-money.provider';

// F-PAY-03's foundation: the webhook handler (increment 3) trusts whatever
// this returns without a second check, so its correctness is tested
// directly here rather than only indirectly through an HTTP integration
// spec later.
describe('SandboxMobileMoneyProvider', () => {
  const provider = new SandboxMobileMoneyProvider();

  describe('initiate', () => {
    it('returns a provider reference derived from the payment id', async () => {
      const result = await provider.initiate({
        paymentId: 'pay_123',
        amountXof: 9000,
        idempotencyKey: 'idem_123',
      });
      expect(result.providerRef).toBe('sandbox_pay_123');
    });
  });

  describe('verifyWebhookSignature', () => {
    const body = JSON.stringify({ idempotencyKey: 'idem_123', status: 'PAID' });

    it('accepts a correctly signed body', () => {
      const signature = provider.sign(body);
      expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
    });

    it('rejects a body that does not match the signature', () => {
      const signature = provider.sign(body);
      const tampered = JSON.stringify({ idempotencyKey: 'idem_123', status: 'FAILED' });
      expect(provider.verifyWebhookSignature(tampered, signature)).toBe(false);
    });

    it('rejects a missing signature header', () => {
      expect(provider.verifyWebhookSignature(body, undefined)).toBe(false);
    });

    it('rejects a signature of the wrong length without throwing', () => {
      expect(() => provider.verifyWebhookSignature(body, 'ab')).not.toThrow();
      expect(provider.verifyWebhookSignature(body, 'ab')).toBe(false);
    });

    it('rejects a same-length but wrong signature', () => {
      const signature = provider.sign(body);
      const flipped = signature.startsWith('a')
        ? `b${signature.slice(1)}`
        : `a${signature.slice(1)}`;
      expect(provider.verifyWebhookSignature(body, flipped)).toBe(false);
    });
  });
});
