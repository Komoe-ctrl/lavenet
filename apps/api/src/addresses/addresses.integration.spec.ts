import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { env } from '../config/env';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP requests through a real Nest app. Bearer tokens minted
// directly with JwtService (same convention as auth-profile.integration.spec.ts)
// -- these routes don't touch login/OTP throttle buckets at all, so there's
// no budget concern here, but the app doesn't need a real login to exercise
// them either.
describe('Address book (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let userA: { id: string };
  let userB: { id: string };
  let tokenA: string;
  let tokenB: string;

  function signToken(userId: string): string {
    return jwt.sign(
      { sub: userId, role: 'CLIENT' },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      label: 'Maison',
      commune: 'Cocody',
      quartier: 'Angré',
      details: 'Immeuble bleu, 2e portail après la pharmacie',
      ...overrides,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    userA = await prisma.user.create({
      data: {
        fullName: 'Aya Kouassi',
        email: `addr-a-${runId}@lavenet.test`,
        phone: `+22521${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    userB = await prisma.user.create({
      data: {
        fullName: 'Kouadio Yao',
        email: `addr-b-${runId}@lavenet.test`,
        phone: `+22522${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });

    tokenA = signToken(userA.id);
    tokenB = signToken(userB.id);
  });

  afterAll(async () => {
    const userIds = [userA.id, userB.id];
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects every address route with no token', async () => {
    await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/addresses`).expect(401);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .send(validPayload())
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/addresses/whatever`)
      .send({ label: 'Nope' })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/addresses/whatever`)
      .expect(401);
  });

  it('rejects a malformed address with a French, specific message -- never "Validation failed"', async () => {
    const badCommune = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ commune: 'Paris' }));
    expect(badCommune.status).toBe(400);
    expect(badCommune.body.message).toBe('Commune invalide.');

    const missingDetails = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ details: 'no' }));
    expect(missingDetails.status).toBe(400);
    expect(missingDetails.body.message).toBe(
      "Merci d'indiquer un repère pour vous trouver (au moins 3 caractères).",
    );
  });

  it("creates an address and lists only the owning user's addresses (IDOR on list)", async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ label: 'Bureau A' }));
    expect(createRes.status).toBe(201);
    expect(createRes.body.address).toMatchObject({
      label: 'Bureau A',
      commune: 'Cocody',
      isDefault: false,
    });

    const listA = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listA.body.addresses).toHaveLength(1);
    expect(listA.body.addresses[0].label).toBe('Bureau A');

    // userB has created nothing yet -- must never see userA's row.
    const listB = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.addresses).toHaveLength(0);
  });

  it("never lets one account read, update or delete another account's address (IDOR)", async () => {
    const created = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ label: 'Adresse privée A' }));
    const addressId = created.body.address.id;

    const updateAttempt = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ label: 'Piratée' });
    expect(updateAttempt.status).toBe(404);

    const deleteAttempt = await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteAttempt.status).toBe(404);

    // Untouched by either attempt.
    const listA = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`);
    const stillThere = listA.body.addresses.find((a: { id: string }) => a.id === addressId);
    expect(stillThere).toMatchObject({ label: 'Adresse privée A' });
  });

  it('updates an owned address', async () => {
    const created = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ label: 'À modifier' }));
    const addressId = created.body.address.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ label: 'Modifiée', quartier: 'Riviera' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.address).toMatchObject({ label: 'Modifiée', quartier: 'Riviera' });
  });

  it('rejects updating or deleting an id that does not exist at all', async () => {
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/addresses/does-not-exist`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ label: 'Nouveau libellé' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/addresses/does-not-exist`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('soft-deletes: the address disappears from the list and cannot be deleted twice', async () => {
    const created = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send(validPayload({ label: 'À supprimer' }));
    const addressId = created.body.address.id;

    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(204);

    const listB = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.addresses.find((a: { id: string }) => a.id === addressId)).toBeUndefined();

    // Already soft-deleted -- a second delete must not silently succeed.
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('guarantees at most one default address server-side, on create and on update', async () => {
    const first = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ label: 'Default 1', isDefault: true }));
    expect(first.body.address.isDefault).toBe(true);

    // Creating a second address as default must demote the first --
    // enforced by the server, regardless of what the client sends.
    const second = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ label: 'Default 2', isDefault: true }));
    expect(second.body.address.isDefault).toBe(true);

    let list = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`);
    let defaults = list.body.addresses.filter((a: { isDefault: boolean }) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe('Default 2');

    // Promoting a third, non-default address via PATCH must demote
    // "Default 2" the same way.
    const third = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload({ label: 'Default 3' }));
    expect(third.body.address.isDefault).toBe(false);

    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/addresses/${third.body.address.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isDefault: true })
      .expect(200);

    list = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/addresses`)
      .set('Authorization', `Bearer ${tokenA}`);
    defaults = list.body.addresses.filter((a: { isDefault: boolean }) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe('Default 3');
  });
});
