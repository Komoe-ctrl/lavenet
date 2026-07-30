import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Prisma 7 requires an explicit driver adapter — DATABASE_URL is the
    // pooled connection, used at runtime (see prisma.config.ts for the
    // unpooled DIRECT_URL used by migrations).
    super({ adapter: new PrismaPg(env.DATABASE_URL) });
  }

  // Deliberately no eager $connect() in onModuleInit: on a free-tier
  // deployment the API and the database can both be cold-starting at once
  // (see docs/ADR/0003-cold-start-strategy.md). Connecting eagerly would
  // make Nest's own boot — and Render's health check — wait on Neon's
  // wake-up. Prisma connects lazily on the first real query instead, and
  // that latency is exactly what the web app's cold-start loading state
  // already covers. This also means the app boots (and the OpenAPI
  // document can be generated) without a reachable database.

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
