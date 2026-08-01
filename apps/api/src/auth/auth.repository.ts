import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
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
}
