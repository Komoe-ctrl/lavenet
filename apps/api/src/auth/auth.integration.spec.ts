import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP requests through a real Nest app against whatever database
// DATABASE_URL/DIRECT_URL point at (the CI Postgres service in CI, the
// Neon dev branch locally — never seeded/relied on: this file creates and
// tears down its own users, so it never touches the demo accounts).
//
// Login calls are deliberately kept to 3 for the whole file: the login
// route is throttled to 5/min (CLAUDE.md §5), and this suite shares one
// app instance (and so one throttle bucket) across every test in it.
describe('Auth (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let loginA: request.Response;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hash(PASSWORD);

    userA = await prisma.user.create({
      data: {
        email: `test-a-${runId}@lavenet.test`,
        phone: `test-phone-a-${runId}`,
        passwordHash,
        role: 'CLIENT',
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `test-b-${runId}@lavenet.test`,
        phone: `test-phone-b-${runId}`,
        passwordHash,
        role: 'CLIENT',
      },
    });

    // The one login call whose response several tests below reuse — see
    // the file-level comment on why call count is kept low.
    loginA = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userA.email, password: PASSWORD });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await app.close();
  });

  it('logs in with valid credentials and sets the refresh cookie', () => {
    expect(loginA.status).toBe(200);
    expect(loginA.body.accessToken).toBeTruthy();
    expect(loginA.body.user).toMatchObject({ id: userA.id, email: userA.email, role: 'CLIENT' });
    expect(loginA.headers['set-cookie']?.[0]).toMatch(/^refresh_token=/);
  });

  it('rejects an invalid password without revealing whether the identifier exists', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userA.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Identifiants invalides.');
  });

  it('rejects /me with no token', async () => {
    await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/auth/me`).expect(401);
  });

  it("/me returns the token's own identity, never another user's", async () => {
    const loginB = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: userB.email, password: PASSWORD });
    expect(loginB.status).toBe(200);

    const meA = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${loginA.body.accessToken}`);
    expect(meA.status).toBe(200);
    expect(meA.body.id).toBe(userA.id);

    const meB = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${loginB.body.accessToken}`);
    expect(meB.status).toBe(200);
    expect(meB.body.id).toBe(userB.id);
  });

  it('rotates the refresh token: the spent cookie stops working, the new one works', async () => {
    const originalCookie = loginA.headers['set-cookie'][0];

    const refreshRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/refresh`)
      .set('Cookie', originalCookie)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();

    const newCookie = refreshRes.headers['set-cookie'][0];
    expect(newCookie).not.toBe(originalCookie);

    // Reusing the just-rotated cookie must now fail — this is what makes
    // rotation a real security property, not just a token refresh.
    const reuseRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/refresh`)
      .set('Cookie', originalCookie)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(reuseRes.status).toBe(401);

    const withNewCookie = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/refresh`)
      .set('Cookie', newCookie)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(withNewCookie.status).toBe(200);
  });
});
