import { Injectable } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
}

interface CreateUserData {
  fullName: string;
  phone: string;
  email?: string;
  passwordHash: string;
}

interface CreateOtpData {
  userId: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
}

interface UpdateProfileData {
  fullName?: string;
  notifyEmail?: boolean;
  notifySms?: boolean;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  // Login identifier is either an email or a phone -- exactly one of the two
  // OR branches can match since both columns are unique.
  findUserByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(data: CreateUserData) {
    return this.prisma.user.create({ data });
  }

  markPhoneVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  createRefreshToken(data: CreateRefreshTokenData) {
    return this.prisma.refreshToken.create({ data });
  }

  revokeRefreshTokenById(id: string) {
    return this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  // Used by logout: revokes by hash (not id) since logout only ever has the
  // raw cookie value, and updateMany rather than update because a token
  // already revoked or not found is a silent no-op, not an error.
  revokeRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Most recent code for this (user, purpose) pair, consumed or not --
  // callers decide what "most recent" means for their check (still valid?
  // sent too recently to resend?).
  findLatestOtp(userId: string, purpose: OtpPurpose) {
    return this.prisma.otpCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
  }

  createOtp(data: CreateOtpData) {
    return this.prisma.otpCode.create({ data });
  }

  incrementOtpAttempts(id: string) {
    return this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  consumeOtp(id: string) {
    return this.prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  // Password reset (unauthenticated) revokes every session on the account:
  // there's no "current" session to preserve, the whole point is that
  // whoever had one shouldn't keep it after a password reset.
  revokeAllRefreshTokensForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Changing a password while authenticated (unlike a reset) has a session
  // making the request -- keepTokenHash lets that one survive while every
  // other one on the account is revoked. Undefined (no refresh cookie on
  // the request, an edge case) falls back to revoking everything.
  revokeOtherRefreshTokens(userId: string, keepTokenHash: string | undefined) {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepTokenHash ? { tokenHash: { not: keepTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  updateProfile(userId: string, data: UpdateProfileData) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  // Changing the phone always drops phoneVerifiedAt back to null -- callers
  // must check uniqueness first (AuthService.changePhone), this method
  // itself has no way to refuse a taken number.
  updatePhone(userId: string, phone: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: null },
    });
  }

  updateEmail(userId: string, email: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { email } });
  }
}
