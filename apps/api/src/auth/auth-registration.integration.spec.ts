import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP requests through a real Nest app (see auth.integration.spec.ts
// for the DB caveat). POST /auth/register is throttled to 5/min (same
// pattern as login, CLAUDE.md §5) and this suite shares one app instance
// (one throttle bucket) across every test -- kept to exactly 4 register
// calls total: userA, a duplicate-phone attempt, a duplicate-email attempt,
// userB. Everything else (otp/verify, otp/resend, login) is unthrottled or
// uses its own separate bucket.
describe('Auth registration + OTP (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  // E.164 requires digits only after the '+' -- runId (hex) can contain
  // a-f, so phones are built from a separate numeric-only suffix instead.
  const phoneDigits = Date.now().toString().slice(-8);
  const userAInput = {
    fullName: 'Aya Kouassi',
    phone: `+22507${phoneDigits}`,
    email: `reg-a-${runId}@lavenet.test`,
    password: PASSWORD,
  };
  const userBInput = {
    fullName: 'Kouadio Yao',
    phone: `+22508${phoneDigits}`,
    email: `reg-b-${runId}@lavenet.test`,
    password: PASSWORD,
  };

  let registerA: request.Response;
  let registerB: request.Response;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    registerA = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send(userAInput);
  });

  afterAll(async () => {
    await prisma.otpCode.deleteMany({
      where: { user: { phone: { in: [userAInput.phone, userBInput.phone] } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { phone: { in: [userAInput.phone, userBInput.phone] } } },
    });
    await prisma.user.deleteMany({
      where: { phone: { in: [userAInput.phone, userBInput.phone] } },
    });
    await app.close();
  });

  it('registers, logs the user in immediately, and includes the demo OTP code', () => {
    expect(registerA.status).toBe(201);
    expect(registerA.body.accessToken).toBeTruthy();
    expect(registerA.body.user).toMatchObject({
      fullName: userAInput.fullName,
      phone: userAInput.phone,
      email: userAInput.email,
      phoneVerified: false,
    });
    expect(registerA.headers['set-cookie']?.[0]).toMatch(/^refresh_token=/);
    // DEMO_MODE=true in the test environment (.env) -- see
    // auth-demo-mode.integration.spec.ts for the DEMO_MODE=false guarantee.
    expect(registerA.body.demoOtpCode).toMatch(/^\d{6}$/);
  });

  it('rejects a phone that is already registered', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send({ ...userBInput, phone: userAInput.phone });
    expect(res.status).toBe(400);
  });

  it('rejects an email that is already registered', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send({ ...userBInput, email: userAInput.email });
    expect(res.status).toBe(400);
  });

  it('registers a second user for the OTP-attempt tests below', async () => {
    registerB = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send(userBInput);
    expect(registerB.status).toBe(201);
  });

  it('rejects otp/verify and otp/resend with no access token', async () => {
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
      .send({
        code: '123456',
      })
      .expect(401);
    await request(app.getHttpServer()).post(`/${API_GLOBAL_PREFIX}/auth/otp/resend`).expect(401);
  });

  it('rejects a wrong code, counts the attempt, and locks out after 5 wrong attempts', async () => {
    const token = registerB.body.accessToken as string;

    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: '000000' });
      expect(res.status).toBe(400);
    }

    // 6th attempt, even though attempts 1-5 already exhausted the budget --
    // locked out regardless of whether this code happens to be right.
    const lockedOut = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: registerB.body.demoOtpCode });
    expect(lockedOut.status).toBe(400);
    expect(lockedOut.body.message).toMatch(/tentatives/i);
  });

  it('resend enforces the 60s cooldown, and the new code verifies successfully', async () => {
    const token = registerB.body.accessToken as string;

    const immediateResend = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/resend`)
      .set('Authorization', `Bearer ${token}`);
    expect(immediateResend.status).toBe(429);

    // Directly age the last OTP row past the cooldown rather than sleeping
    // 60s in a test -- same effect, doesn't slow the suite down.
    await prisma.otpCode.updateMany({
      where: { user: { phone: userBInput.phone } },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });

    const resend = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/resend`)
      .set('Authorization', `Bearer ${token}`);
    expect(resend.status).toBe(200);
    expect(resend.body.demoOtpCode).toMatch(/^\d{6}$/);

    const verify = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: resend.body.demoOtpCode });
    expect(verify.status).toBe(200);
    expect(verify.body.user.phoneVerified).toBe(true);
  });

  it('verifies the correct code and is idempotent on a second call', async () => {
    const token = registerA.body.accessToken as string;

    const verify = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: registerA.body.demoOtpCode });
    expect(verify.status).toBe(200);
    expect(verify.body.user.phoneVerified).toBe(true);

    // Already verified -- succeeds without even checking the code, so a
    // harmless re-submit (e.g. a double click) never errors.
    const again = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });
    expect(again.status).toBe(200);
  });

  it('logs in with a phone identifier, not just email', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userAInput.phone, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(userAInput.phone);
  });
});
