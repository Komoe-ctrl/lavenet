import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP requests through a real Nest app. Bug report: local-format
// phone input ("0700070007") was rejected with an English, uninformative
// "Validation failed", and login/uniqueness compared raw strings instead
// of the canonical +225 form. Covers the normalization end to end, not
// just the shared-schemas unit tests -- specifically the cross-cutting
// case the bug report called out: register in one format, log in with
// another, uniqueness catching a duplicate submitted in a different format
// than the one already on file.
describe('Phone number format handling (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  // Local format, as "tout le monde utilise" (bug report) -- 0 + 9 digits.
  const localPhone = `0${phoneDigits}1`;
  const canonicalPhone = `+225${localPhone}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.otpCode.deleteMany({ where: { user: { phone: canonicalPhone } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone: canonicalPhone } } });
    await prisma.user.deleteMany({ where: { phone: canonicalPhone } });
    await app.close();
  });

  it('registers with a local-format phone and stores the canonical +225 form', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send({
        fullName: 'Format Test',
        phone: localPhone,
        email: `phone-format-${runId}@lavenet.test`,
        password: PASSWORD,
      });
    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe(canonicalPhone);
  });

  it('logs in with a different phone format than the one used at registration', async () => {
    // Registered above with the bare local digits -- logging in with the
    // spaced-out local format must still resolve to the same account.
    const spaced = localPhone.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/login`)
      .send({ identifier: spaced, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(canonicalPhone);
  });

  it('rejects a duplicate registration submitted in the canonical +225 form', async () => {
    // Same number as the account already registered in local form above --
    // uniqueness must compare canonical forms, not raw strings.
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send({
        fullName: 'Format Test Duplicate',
        phone: canonicalPhone,
        password: PASSWORD,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Ce numéro de téléphone est déjà utilisé.');
  });

  it('rejects a genuinely invalid phone with a French, specific message -- not "Validation failed"', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/auth/register`)
      .send({
        fullName: 'Bad Phone',
        phone: '12345',
        password: PASSWORD,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Numéro invalide. Format attendu : 07 00 07 00 07');
    expect(res.body.message).not.toBe('Validation failed');
  });
});
