import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { env } from '../config/env';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP requests through a real Nest app. Bearer tokens for most tests
// below are minted directly with JwtService (same secret/claims shape as
// AuthService's private signAccessToken) instead of via /auth/login, so
// these tests don't compete with the login throttle bucket (5/min, shared
// across this file) -- only the password-change test genuinely needs to
// exercise real login/session behavior, and stays under budget on its own.
describe('Profile editing (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let userA: { id: string; role: string; phone: string; email: string };
  let userB: { id: string; role: string; phone: string; email: string };
  let tokenA: string;
  let tokenB: string;

  function signToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    userA = await prisma.user.create({
      data: {
        fullName: 'Aya Kouassi',
        email: `profile-a-${runId}@lavenet.test`,
        phone: `+22511${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    userB = await prisma.user.create({
      data: {
        fullName: 'Kouadio Yao',
        email: `profile-b-${runId}@lavenet.test`,
        phone: `+22512${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });

    tokenA = signToken(userA.id, 'CLIENT');
    tokenB = signToken(userB.id, 'CLIENT');
  });

  afterAll(async () => {
    const userIds = [userA.id, userB.id];
    await prisma.otpCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects every profile route with no token', async () => {
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/auth/profile`)
      .send({ fullName: 'Nope' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/password`)
      .send({ currentPassword: PASSWORD, newPassword: 'Whatever123!' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/phone`)
      .send({ currentPassword: PASSWORD, newPhone: '+2250700000000' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/email`)
      .send({ currentPassword: PASSWORD, newEmail: 'x@y.com' })
      .expect(401);
  });

  it('updates fullName/notification prefs, and never lets one account edit another (IDOR)', async () => {
    const resA = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/auth/profile`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'Aya K. Updated', notifyEmail: false, notifySms: true });
    expect(resA.status).toBe(200);
    expect(resA.body.user).toMatchObject({ id: userA.id, fullName: 'Aya K. Updated' });

    // userB's own PATCH, authenticated as userB, must only ever touch
    // userB's row -- there is no user id in the request body to spoof, but
    // this proves the route really scopes by the token, not by accident.
    const resB = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/auth/profile`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ fullName: 'Someone Else Entirely' });
    expect(resB.status).toBe(200);
    expect(resB.body.user.id).toBe(userB.id);

    const meA = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(meA.body.fullName).toBe('Aya K. Updated');
  });

  it('rejects a phone or email change with the wrong current password', async () => {
    const phoneRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/phone`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: 'wrong-password', newPhone: `+22513${phoneDigits}` });
    expect(phoneRes.status).toBe(401);

    const emailRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/email`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: 'wrong-password', newEmail: `still-a-${runId}@lavenet.test` });
    expect(emailRes.status).toBe(401);
  });

  it('rejects a phone change to a number already in use, and leaves phoneVerifiedAt untouched', async () => {
    // userB attempts to "steal" userA's already-verified phone.
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/phone`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ currentPassword: PASSWORD, newPhone: userA.phone });
    expect(res.status).toBe(400);

    // The uniqueness check must run before phoneVerifiedAt is ever
    // touched -- userB's own phone must still be verified afterward, not
    // left unverified for a change that never actually happened.
    const meB = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(meB.body.phoneVerified).toBe(true);
    expect(meB.body.phone).toBe(userB.phone);
  });

  it('rejects an email change to an address already in use', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/email`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ currentPassword: PASSWORD, newEmail: userA.email });
    expect(res.status).toBe(400);

    const meB = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(meB.body.email).toBe(userB.email);
  });

  it('changes the phone, resets phoneVerifiedAt, and the new number re-verifies', async () => {
    const newPhone = `+22514${phoneDigits}`;
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/phone`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: PASSWORD, newPhone });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(newPhone);
    expect(res.body.user.phoneVerified).toBe(false);
    expect(res.body.demoOtpCode).toMatch(/^\d{6}$/);

    const verify = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/otp/verify`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: res.body.demoOtpCode });
    expect(verify.status).toBe(200);
    expect(verify.body.user.phoneVerified).toBe(true);

    userA.phone = newPhone;
  });

  it('changes the email', async () => {
    const newEmail = `profile-a-updated-${runId}@lavenet.test`;
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/email`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: PASSWORD, newEmail });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(newEmail);
  });

  it('rejects a password change with the wrong current password', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/password`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'Whatever123!' });
    expect(res.status).toBe(401);
  });

  it('changes the password, keeps the requesting session, and revokes every other one', async () => {
    // Two real sessions for userB -- exercising the actual login flow,
    // since session survival/revocation is precisely what's under test.
    // 4 /auth/login calls total in this test, under the file's 5/min budget.
    const session1 = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userB.email, password: PASSWORD });
    expect(session1.status).toBe(200);
    const cookie1 = session1.headers['set-cookie'][0];

    const session2 = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userB.email, password: PASSWORD });
    expect(session2.status).toBe(200);
    const cookie2 = session2.headers['set-cookie'][0];

    const newPassword = 'BrandNewB1234!';
    const change = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/profile/password`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Cookie', cookie1)
      .send({ currentPassword: PASSWORD, newPassword });
    expect(change.status).toBe(200);
    expect(change.body.user.id).toBe(userB.id);

    // Session 1 -- the one that made the change-password request -- survives.
    const refresh1 = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/refresh`)
      .set('Cookie', cookie1)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(refresh1.status).toBe(200);

    // Session 2 does not.
    const refresh2 = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/refresh`)
      .set('Cookie', cookie2)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(refresh2.status).toBe(401);

    const oldPasswordLogin = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userB.email, password: PASSWORD });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userB.email, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
  });
});
