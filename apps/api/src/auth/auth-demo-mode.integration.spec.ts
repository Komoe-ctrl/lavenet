import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';

// DEMO_MODE=false must be set before AppModule (and anything importing
// config/env.ts) is evaluated -- env.ts reads process.env once at module
// load time. Static `import` statements are hoisted above any other
// top-level code, so setting process.env here and importing AppModule at
// the top of the file (like every other integration spec) would run env.ts
// with whatever DEMO_MODE was already in .env, too late to matter. Dynamic
// `import()` after the assignment is the only way to sequence this
// correctly; vitest isolates modules per file, so this only affects this
// file's module graph, not the other auth integration specs.
process.env.DEMO_MODE = 'false';
const { AppModule } = await import('../app/app.module');
const { API_GLOBAL_PREFIX } = await import('../swagger.config');
const { PrismaService: PrismaServiceClass } = await import('../prisma/prisma.service');

// Guarantees the user asked for explicitly: outside DEMO_MODE, the OTP code
// never appears in an API response (or anywhere else this suite can see).
describe('Auth OTP responses with DEMO_MODE=false (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  const input = {
    fullName: 'Demo Off',
    phone: `+22509${phoneDigits}`,
    email: `demo-off-${runId}@lavenet.test`,
    password: 'Integration1234!',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaServiceClass);
  });

  afterAll(async () => {
    await prisma.otpCode.deleteMany({ where: { user: { phone: input.phone } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone: input.phone } } });
    await prisma.user.deleteMany({ where: { phone: input.phone } });
    await app.close();
  });

  it('omits demoOtpCode from the register response', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send(input);
    expect(res.status).toBe(201);
    expect(res.body.demoOtpCode).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/"demoOtpCode"/);
  });

  it('omits demoOtpCode from the resend response', async () => {
    const registerRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send({ ...input, phone: `${input.phone}1`, email: `second-${input.email}` });
    const token = registerRes.body.accessToken as string;

    // Age the just-created OTP past the resend cooldown (see
    // auth-registration.integration.spec.ts for why this beats a real sleep).
    await prisma.otpCode.updateMany({
      where: { user: { phone: `${input.phone}1` } },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });

    const resend = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/resend`)
      .set('Authorization', `Bearer ${token}`);
    expect(resend.status).toBe(200);
    expect(resend.body.demoOtpCode).toBeUndefined();
    expect(JSON.stringify(resend.body)).not.toMatch(/"demoOtpCode"/);

    await prisma.otpCode.deleteMany({ where: { user: { phone: `${input.phone}1` } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone: `${input.phone}1` } } });
    await prisma.user.deleteMany({ where: { phone: `${input.phone}1` } });
  });
});
