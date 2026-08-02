import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app/app.module';
import { EMAIL_PROVIDER } from '../notifications/email/email-provider.interface';
import { SMS_PROVIDER } from '../notifications/sms/sms-provider.interface';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP requests through a real Nest app. EMAIL_PROVIDER/SMS_PROVIDER
// are overridden with spies: the HTTP response is identical either way a
// code goes out (demoOtpCode is present regardless of channel), so this is
// the only way to verify the "email if the account has one, phone
// otherwise" rule from outside the service. password-reset/request is
// throttled to 5/min (same reasoning as register/login) -- kept to exactly
// 4 calls across this file, one spare under the limit.
describe('Password reset (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailSend: ReturnType<typeof vi.fn>;
  let smsSend: ReturnType<typeof vi.fn>;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let userWithEmail: { id: string; email: string; phone: string };
  let userPhoneOnly: { id: string; phone: string };

  beforeAll(async () => {
    emailSend = vi.fn().mockResolvedValue(undefined);
    smsSend = vi.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue({ send: emailSend })
      .overrideProvider(SMS_PROVIDER)
      .useValue({ send: smsSend })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hash(PASSWORD);

    userWithEmail = await prisma.user.create({
      data: {
        fullName: 'Aya Kouassi',
        email: `pwreset-a-${runId}@lavenet.test`,
        phone: `+22509${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    userPhoneOnly = await prisma.user.create({
      data: {
        fullName: 'Kouadio Yao',
        phone: `+22510${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    const userIds = [userWithEmail.id, userPhoneOnly.id];
    await prisma.otpCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('sends the code by email when the account has one', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/request`)
      .send({ identifier: userWithEmail.email });
    expect(res.status).toBe(200);
    expect(res.body.demoOtpCode).toMatch(/^\d{6}$/);
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(emailSend.mock.calls[0][0]).toBe(userWithEmail.email);
    expect(smsSend).not.toHaveBeenCalled();
  });

  it('falls back to SMS when the account has no email', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/request`)
      .send({ identifier: userPhoneOnly.phone });
    expect(res.status).toBe(200);
    expect(res.body.demoOtpCode).toMatch(/^\d{6}$/);
    expect(smsSend).toHaveBeenCalledTimes(1);
    expect(smsSend.mock.calls[0][0]).toBe(userPhoneOnly.phone);
  });

  it('always responds 200 without a demo code for an unregistered identifier', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/request`)
      .send({ identifier: `nobody-${runId}@lavenet.test` });
    expect(res.status).toBe(200);
    expect(res.body.demoOtpCode).toBeUndefined();
  });

  it('rejects confirm with the wrong code, counts the attempt, and locks out after 5', async () => {
    // Reuses the OTP created by the first test above rather than issuing a
    // fresh request -- password-reset/request is throttled, see file header.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/confirm`)
        .send({ identifier: userWithEmail.email, code: '000000', newPassword: 'Whatever123!' });
      expect(res.status).toBe(400);
    }

    const lockedOut = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/confirm`)
      .send({ identifier: userWithEmail.email, code: '000000', newPassword: 'Whatever123!' });
    expect(lockedOut.status).toBe(400);
    expect(lockedOut.body.message).toMatch(/tentatives/i);
  });

  it('does not reveal account existence on confirm either', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/confirm`)
      .send({
        identifier: `nobody-${runId}@lavenet.test`,
        code: '123456',
        newPassword: 'Whatever123!',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Code invalide.');
  });

  it('resets the password, logs the user in, and revokes every prior session', async () => {
    // A session that must not survive the reset.
    const priorLogin = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userPhoneOnly.phone, password: PASSWORD });
    expect(priorLogin.status).toBe(200);
    const priorCookie = priorLogin.headers['set-cookie'][0];

    const req = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/request`)
      .send({ identifier: userPhoneOnly.phone });
    const code = req.body.demoOtpCode as string;
    expect(code).toMatch(/^\d{6}$/);

    const newPassword = 'BrandNew1234!';
    const confirm = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/password-reset/confirm`)
      .send({ identifier: userPhoneOnly.phone, code, newPassword });
    expect(confirm.status).toBe(200);
    expect(confirm.body.accessToken).toBeTruthy();
    expect(confirm.body.user.phone).toBe(userPhoneOnly.phone);
    expect(confirm.headers['set-cookie']?.[0]).toMatch(/^refresh_token=/);

    // The pre-reset session is dead.
    const reuse = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/refresh`)
      .set('Cookie', priorCookie)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(reuse.status).toBe(401);

    // The old password no longer works, the new one does.
    const oldPasswordLogin = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userPhoneOnly.phone, password: PASSWORD });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userPhoneOnly.phone, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
  });
});
