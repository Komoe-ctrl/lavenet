import { Injectable } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateOtpData {
  userId: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
}

// Moved out of AuthRepository (F-LIV-04): these four methods and the
// OtpCode table were never specific to auth, just its only caller until
// now. AuthRepository keeps everything else (users, refresh tokens).
@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Most recent code for this (user, purpose) pair, consumed or not --
  // callers decide what "most recent" means for their check (still valid?
  // sent too recently to resend?).
  findLatest(userId: string, purpose: OtpPurpose) {
    return this.prisma.otpCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: CreateOtpData) {
    return this.prisma.otpCode.create({ data });
  }

  incrementAttempts(id: string) {
    return this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  consume(id: string) {
    return this.prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }
}
