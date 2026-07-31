import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '@lavenet/shared-schemas';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface UserRecord {
  id: string;
  email: string | null;
  phone: string;
  role: string;
  passwordHash: string;
  deletedAt: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      // Same message for "no such user" and "wrong password": don't let the
      // login endpoint be used to enumerate registered emails.
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

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée.');
    }

    // Rotation: the presented token is single-use — revoke it and issue a
    // fresh one, even though the access token it mints is the same user.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
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
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
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
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent,
      },
    });
    return rawToken;
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role as AuthUser['role'],
    };
  }
}
