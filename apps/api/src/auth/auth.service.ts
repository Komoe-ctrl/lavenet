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
import { EMAIL_PROVIDER, EmailProvider } from '../notifications/email/email-provider.interface';
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
  notifyEmail: boolean;
  notifySms: boolean;
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
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
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
    const demoOtpCode = await this.issuePhoneOtp(
      user.id,
      user.phone,
      OtpPurpose.PHONE_VERIFICATION,
    );

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

    const demoOtpCode = await this.issuePhoneOtp(
      user.id,
      user.phone,
      OtpPurpose.PHONE_VERIFICATION,
    );
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

  // Always resolves, whether or not the identifier is registered -- never
  // reveals account existence (same rule as login). demoOtpCode is only
  // ever populated when the account exists and DEMO_MODE=true.
  async requestPasswordReset(identifier: string): Promise<{ demoOtpCode?: string }> {
    const user = await this.repository.findUserByIdentifier(identifier);
    if (!user || user.deletedAt) {
      return {};
    }
    const demoOtpCode = await this.issuePasswordResetOtp(user);
    return { demoOtpCode };
  }

  async confirmPasswordReset(
    identifier: string,
    code: string,
    newPassword: string,
    userAgent?: string,
  ) {
    const user = await this.repository.findUserByIdentifier(identifier);
    // Same generic message whether the identifier doesn't exist or the code
    // is wrong -- don't let this endpoint be used to enumerate accounts.
    if (!user || user.deletedAt) {
      throw new BadRequestException('Code invalide.');
    }

    const stored = await this.repository.findLatestOtp(user.id, OtpPurpose.PASSWORD_RESET);
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
    const passwordHash = await hash(newPassword);
    await this.repository.updatePasswordHash(user.id, passwordHash);
    // No "current" session to preserve here -- the caller isn't
    // authenticated, so every existing refresh token on the account is
    // revoked, then a fresh one issued below for the session this creates.
    await this.repository.revokeAllRefreshTokensForUser(user.id);

    const accessToken = this.signAccessToken(user.id, user.role);
    const refreshToken = await this.issueRefreshToken(user.id, userAgent);
    return { accessToken, refreshToken, user: this.toAuthUser(user) };
  }

  async updateProfile(
    userId: string,
    input: { fullName?: string; notifyEmail?: boolean; notifySms?: boolean },
  ): Promise<AuthUser> {
    const user = await this.repository.updateProfile(userId, input);
    return this.toAuthUser(user);
  }

  // currentRefreshToken is the raw cookie value of the session making this
  // request (if any) -- kept alive while every other session on the
  // account is revoked (F-AUTH-05: unlike a password reset, there IS a
  // "current" session here, and forcing it to log out right after the user
  // deliberately changed their own password would be a bad experience).
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken?: string,
  ): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    await this.assertCurrentPassword(user, currentPassword);

    const passwordHash = await hash(newPassword);
    await this.repository.updatePasswordHash(userId, passwordHash);
    await this.repository.revokeOtherRefreshTokens(
      userId,
      currentRefreshToken ? hashToken(currentRefreshToken) : undefined,
    );
    return this.toAuthUser({ ...user, passwordHash });
  }

  async changePhone(
    userId: string,
    currentPassword: string,
    newPhone: string,
  ): Promise<{ user: AuthUser; demoOtpCode?: string }> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    await this.assertCurrentPassword(user, currentPassword);

    // Uniqueness must be checked before phoneVerifiedAt is ever touched --
    // otherwise a conflicting attempt leaves the account with an unverified
    // phone for no reason (the number never actually changed).
    const conflict = await this.repository.findUserByPhone(newPhone);
    if (conflict && conflict.id !== userId) {
      throw new BadRequestException('Ce numéro de téléphone est déjà utilisé.');
    }

    const updated = await this.repository.updatePhone(userId, newPhone);
    const demoOtpCode = await this.issuePhoneOtp(userId, newPhone, OtpPurpose.PHONE_VERIFICATION);
    return { user: this.toAuthUser(updated), demoOtpCode };
  }

  async changeEmail(userId: string, currentPassword: string, newEmail: string): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    await this.assertCurrentPassword(user, currentPassword);

    const conflict = await this.repository.findUserByEmail(newEmail);
    if (conflict && conflict.id !== userId) {
      throw new BadRequestException('Cet email est déjà utilisé.');
    }

    const updated = await this.repository.updateEmail(userId, newEmail);
    return this.toAuthUser(updated);
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

  private async createOtp(userId: string, purpose: OtpPurpose): Promise<string> {
    const code = generateOtpCode();
    await this.repository.createOtp({
      userId,
      purpose,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    return code;
  }

  // Returns the raw code only in DEMO_MODE (see registerResponseSchema) --
  // never present otherwise, so it can never leak into a response or a log
  // outside the explicitly-opted-into demo deployment (CLAUDE.md §11).
  private async issuePhoneOtp(
    userId: string,
    phone: string,
    purpose: OtpPurpose,
  ): Promise<string | undefined> {
    const code = await this.createOtp(userId, purpose);
    await this.smsProvider.send(phone, `Votre code LaveNet : ${code} (valable 10 minutes).`);
    return env.DEMO_MODE ? code : undefined;
  }

  // Password reset sends the code by whichever channel the account has:
  // email if the (optional) address is set, phone otherwise -- phone is
  // always present (F-AUTH-01), so this never has no channel to use.
  private async issuePasswordResetOtp(user: UserRecord): Promise<string | undefined> {
    const code = await this.createOtp(user.id, OtpPurpose.PASSWORD_RESET);
    if (user.email) {
      await this.emailProvider.send(
        user.email,
        'Réinitialisation de votre mot de passe LaveNet',
        `Votre code de réinitialisation : ${code} (valable 10 minutes).`,
      );
    } else {
      await this.smsProvider.send(
        user.phone,
        `Votre code de réinitialisation LaveNet : ${code} (valable 10 minutes).`,
      );
    }
    return env.DEMO_MODE ? code : undefined;
  }

  private async assertCurrentPassword(user: UserRecord, currentPassword: string): Promise<void> {
    const valid = await verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerifiedAt !== null,
      notifyEmail: user.notifyEmail,
      notifySms: user.notifySms,
      role: user.role as AuthUser['role'],
    };
  }
}
