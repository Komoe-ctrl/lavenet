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
}
