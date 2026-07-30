import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 requires an explicit driver adapter — DATABASE_URL is the
    // pooled connection, used at runtime (see prisma.config.ts for the
    // unpooled DIRECT_URL used by migrations).
    super({ adapter: new PrismaPg(env.DATABASE_URL) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
