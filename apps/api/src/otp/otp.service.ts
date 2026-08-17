import { Injectable } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import { OtpRepository } from './otp.repository';

// CLAUDE.md §4 rule 7: 6 digits, 5 attempts max -- both purpose-independent
// defaults. TTL is not: PHONE_VERIFICATION/PASSWORD_RESET use 10 min,
// DELIVERY_HANDOFF (F-LIV-04) uses 24h, per the cahier. Every caller passes
// its own ttlMs rather than this module guessing per purpose.
const DEFAULT_MAX_ATTEMPTS = 5;

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE' };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateCode(): string {
  // 100000-999999: always 6 digits, never zero-padded-from-shorter.
  return randomInt(100_000, 1_000_000).toString();
}

// Generic OTP mechanics (generate/hash/verify/expire/rate-limit attempts),
// used by every purpose in OtpPurpose -- extracted from AuthService/
// AuthRepository (F-LIV-04) so a second purpose doesn't mean a second
// mechanism. AuthService's PHONE_VERIFICATION/PASSWORD_RESET flows and the
// delivery-confirmation flow both go through this one class.
@Injectable()
export class OtpService {
  constructor(private readonly repository: OtpRepository) {}

  async generate(userId: string, purpose: OtpPurpose, ttlMs: number): Promise<string> {
    const code = generateCode();
    await this.repository.create({
      userId,
      purpose,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return code;
  }

  // Consumes the code on success -- callers never call a separate "consume"
  // step, exactly matching the two call sites this replaced
  // (AuthService.verifyOtp/confirmPasswordReset used to do it by hand).
  async verify(userId: string, purpose: OtpPurpose, code: string): Promise<OtpVerifyResult> {
    const stored = await this.repository.findLatest(userId, purpose);
    if (!stored || stored.consumedAt) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    if (stored.expiresAt < new Date()) {
      return { ok: false, reason: 'EXPIRED' };
    }
    if (stored.attempts >= DEFAULT_MAX_ATTEMPTS) {
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    }
    if (hashToken(code) !== stored.codeHash) {
      await this.repository.incrementAttempts(stored.id);
      return { ok: false, reason: 'INVALID_CODE' };
    }

    await this.repository.consume(stored.id);
    return { ok: true };
  }

  // Used only for the resend-cooldown check (AuthService.resendOtp) -- the
  // cooldown window itself is auth-specific policy, not generic OTP
  // mechanics, so it stays out of this service.
  findLatest(userId: string, purpose: OtpPurpose) {
    return this.repository.findLatest(userId, purpose);
  }
}
