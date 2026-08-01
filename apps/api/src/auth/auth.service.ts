import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { OtpPurpose } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { AuthUser } from '@lavenet/shared-schemas';
import { env } from '../config/env';
import { SMS_PROVIDER, SmsProvider } from '../notifications/sms/sms-provider.interface';
import { AuthRepository } from './auth.repository';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// CLAUDE.md §4 rule 7: OTP 6 digits, 10 min TTL, 5 attempts max, resend
// after 60s.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateOtpCode(): string {
  // 100000-999999: always 6 digits, never zero-padded-from-shorter.
  return randomInt(100_000, 1_000_000).toString();
}

interface UserRecord {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string;
  phoneVerifiedAt: Date | null;
  role: string;
  passwordHash: string;
  deletedAt: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async register(
    input: { fullName: string; phone: string; email?: string; password: string },
    userAgent?: string,
  ) {
    if (await this.repository.findUserByPhone(input.phone)) {
      throw new BadRequestException('Ce numéro de téléphone est déjà utilisé.');
    }
    if (input.email && (await this.repository.findUserByEmail(input.email))) {
      throw new BadRequestException('Cet email est déjà utilisé.');
    }

    const passwordHash = await hash(input.password);
    const user = await this.repository.createUser({
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      passwordHash,
    });

    const accessToken = this.signAccessToken(user.id, user.role);
    const refreshToken = await this.issueRefreshToken(user.id, userAgent);
    const demoOtpCode = await this.issueOtp(user.id, user.phone, OtpPurpose.PHONE_VERIFICATION);

    return { accessToken, refreshToken, user: this.toAuthUser(user), demoOtpCode };
  }

  async verifyOtp(userId: string, code: string): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    // Idempotent: verifying an already-verified phone just confirms the
    // current state instead of erroring on a harmless re-submit.
    if (user.phoneVerifiedAt) {
      return this.toAuthUser(user);
    }

    const stored = await this.repository.findLatestOtp(userId, OtpPurpose.PHONE_VERIFICATION);
    if (!stored || stored.consumedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Code expiré ou introuvable, demandez-en un nouveau.');
    }
    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Trop de tentatives, demandez un nouveau code.');
    }

    if (hashToken(code) !== stored.codeHash) {
      await this.repository.incrementOtpAttempts(stored.id);
      throw new BadRequestException('Code invalide.');
    }

    await this.repository.consumeOtp(stored.id);
    const verified = await this.repository.markPhoneVerified(userId);
    return this.toAuthUser(verified);
  }

  async resendOtp(userId: string): Promise<{ demoOtpCode?: string }> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    if (user.phoneVerifiedAt) {
      throw new BadRequestException('Téléphone déjà vérifié.');
    }

    const last = await this.repository.findLatestOtp(userId, OtpPurpose.PHONE_VERIFICATION);
    if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'Veuillez patienter avant de redemander un code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const demoOtpCode = await this.issueOtp(user.id, user.phone, OtpPurpose.PHONE_VERIFICATION);
    return { demoOtpCode };
  }

  async login(identifier: string, password: string, userAgent?: string) {
    const user = await this.repository.findUserByIdentifier(identifier);
    if (!user || user.deletedAt) {
      // Same message for "no such account" and "wrong password": don't let
      // the login endpoint be used to enumerate registered emails/phones.
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const passwordValid = await verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const accessToken = this.signAccessToken(user.id, user.role);
    const refreshToken = await this.issueRefreshToken(user.id, userAgent);

    return { accessToken, refreshToken, user: this.toAuthUser(user) };
  }

  async refresh(rawToken: string | undefined, userAgent?: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Session expirée.');
    }

    const stored = await this.repository.findRefreshTokenByHash(hashToken(rawToken));

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée.');
    }

    // Rotation: the presented token is single-use — revoke it and issue a
    // fresh one, even though the access token it mints is the same user.
    await this.repository.revokeRefreshTokenById(stored.id);

    const user = await this.repository.findUserById(stored.userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Session expirée.');
    }

    const accessToken = this.signAccessToken(user.id, user.role);
    const refreshToken = await this.issueRefreshToken(user.id, userAgent);

    return { accessToken, refreshToken };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.repository.revokeRefreshTokenByHash(hashToken(rawToken));
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    return this.toAuthUser(user);
  }

  verifyAccessToken(token: string): { sub: string; role: string } {
    return this.jwt.verify(token, { secret: env.JWT_ACCESS_SECRET });
  }

  private signAccessToken(userId: string, role: string): string {
    return this.jwt.sign(
      { sub: userId, role },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private async issueRefreshToken(userId: string, userAgent?: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    await this.repository.createRefreshToken({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent,
    });
    return rawToken;
  }

  // Returns the raw code only in DEMO_MODE (see registerResponseSchema) --
  // never present otherwise, so it can never leak into a response or a log
  // outside the explicitly-opted-into demo deployment (CLAUDE.md §11).
  private async issueOtp(
    userId: string,
    phone: string,
    purpose: OtpPurpose,
  ): Promise<string | undefined> {
    const code = generateOtpCode();
    await this.repository.createOtp({
      userId,
      purpose,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    await this.smsProvider.send(phone, `Votre code LaveNet : ${code} (valable 10 minutes).`);
    return env.DEMO_MODE ? code : undefined;
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerifiedAt !== null,
      role: user.role as AuthUser['role'],
    };
  }
}
