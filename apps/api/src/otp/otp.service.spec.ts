import { createHash } from 'node:crypto';
import { OtpPurpose } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OtpRepository } from './otp.repository';
import { OtpService } from './otp.service';

function hashOf(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function storedOtp(overrides: Partial<Awaited<ReturnType<OtpRepository['findLatest']>>> = {}) {
  return {
    id: 'otp_1',
    userId: 'user_1',
    purpose: OtpPurpose.PHONE_VERIFICATION,
    codeHash: hashOf('123456'),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// F-LIV-04. Unit-level, not routed through AuthService's integration
// specs -- this is the one place the TTL parameter (10 min for auth,
// 24h for delivery handoff) and the full verify() outcome matrix get
// exercised directly.
describe('OtpService', () => {
  let repository: {
    findLatest: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    incrementAttempts: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
  };
  let service: OtpService;

  beforeEach(() => {
    repository = {
      findLatest: vi.fn(),
      create: vi.fn(),
      incrementAttempts: vi.fn(),
      consume: vi.fn(),
    };
    service = new OtpService(repository as unknown as OtpRepository);
  });

  describe('generate', () => {
    it('creates a hashed 6-digit code with the requested TTL and returns the raw code', async () => {
      const before = Date.now();
      const code = await service.generate('user_1', OtpPurpose.DELIVERY_HANDOFF, 24 * 60 * 60 * 1000);

      expect(code).toMatch(/^\d{6}$/);
      expect(repository.create).toHaveBeenCalledTimes(1);
      const call = repository.create.mock.calls[0][0];
      expect(call.userId).toBe('user_1');
      expect(call.purpose).toBe(OtpPurpose.DELIVERY_HANDOFF);
      expect(call.codeHash).toBe(hashOf(code));
      // 24h TTL, allowing generous slack for the test's own execution time.
      expect(call.expiresAt.getTime() - before).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(call.expiresAt.getTime() - before).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('verify', () => {
    it('rejects when no code was ever generated', async () => {
      repository.findLatest.mockResolvedValue(null);
      const result = await service.verify('user_1', OtpPurpose.PHONE_VERIFICATION, '123456');
      expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    });

    it('rejects an already-consumed code', async () => {
      repository.findLatest.mockResolvedValue(storedOtp({ consumedAt: new Date() }));
      const result = await service.verify('user_1', OtpPurpose.PHONE_VERIFICATION, '123456');
      expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    });

    it('rejects an expired code', async () => {
      repository.findLatest.mockResolvedValue(
        storedOtp({ expiresAt: new Date(Date.now() - 1000) }),
      );
      const result = await service.verify('user_1', OtpPurpose.PHONE_VERIFICATION, '123456');
      expect(result).toEqual({ ok: false, reason: 'EXPIRED' });
    });

    it('rejects after 5 attempts, without checking the code', async () => {
      repository.findLatest.mockResolvedValue(storedOtp({ attempts: 5 }));
      const result = await service.verify('user_1', OtpPurpose.PHONE_VERIFICATION, '123456');
      expect(result).toEqual({ ok: false, reason: 'TOO_MANY_ATTEMPTS' });
      expect(repository.incrementAttempts).not.toHaveBeenCalled();
    });

    it('increments attempts and rejects a wrong code', async () => {
      repository.findLatest.mockResolvedValue(storedOtp());
      const result = await service.verify('user_1', OtpPurpose.PHONE_VERIFICATION, '000000');
      expect(result).toEqual({ ok: false, reason: 'INVALID_CODE' });
      expect(repository.incrementAttempts).toHaveBeenCalledWith('otp_1');
      expect(repository.consume).not.toHaveBeenCalled();
    });

    it('consumes and accepts the correct code', async () => {
      repository.findLatest.mockResolvedValue(storedOtp());
      const result = await service.verify('user_1', OtpPurpose.PHONE_VERIFICATION, '123456');
      expect(result).toEqual({ ok: true });
      expect(repository.consume).toHaveBeenCalledWith('otp_1');
      expect(repository.incrementAttempts).not.toHaveBeenCalled();
    });
  });
});
