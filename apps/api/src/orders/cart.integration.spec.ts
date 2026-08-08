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

// Real HTTP + real database, own throwaway catalog fixtures (unique per
// run, same convention as catalog.integration.spec.ts) so this suite never
// depends on or corrupts the demo seed.
describe('Cart (integration)', () => {
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

  const categoryId = `cat-cart-test-${runId}`;
  const articleTypeId = `art-cart-test-${runId}`;
  const kgServiceId = `svc-kg-cart-test-${runId}`;
  const pieceServiceId = `svc-piece-cart-test-${runId}`;
  const inactiveServiceId = `svc-inactive-cart-test-${runId}`;
  const revocableServiceId = `svc-revocable-cart-test-${runId}`;
  const agencyId = `agy-cart-test-${runId}`;
  const pickupSlotId = `slot-pickup-${runId}`;
  const deliveryTooEarlyHomeId = `slot-delivery-early-home-${runId}`;
  const deliveryValidHomeId = `slot-delivery-valid-home-${runId}`;
  const deliveryTooEarlyAgencyId = `slot-delivery-early-agency-${runId}`;
  const deliveryValidAgencyId = `slot-delivery-valid-agency-${runId}`;
  // F-CMD-05/07 (increment 4) fixtures.
  const addressAId = `addr-cart-test-a-${runId}`;
  const addressBId = `addr-cart-test-b-${runId}`;
  const deletedAddressId = `addr-cart-test-deleted-${runId}`;
  const checkoutPickupSlotId = `slot-checkout-pickup-${runId}`;
  const checkoutDeliverySlotId = `slot-checkout-delivery-${runId}`;
  const checkoutAgencyDeliverySlotId = `slot-checkout-agency-delivery-${runId}`;
  const racePickupSlotId = `slot-race-pickup-${runId}`;
  const raceSlotId = `slot-race-delivery-${runId}`;
  const timeSlotIds = [
    pickupSlotId,
    deliveryTooEarlyHomeId,
    deliveryValidHomeId,
    deliveryTooEarlyAgencyId,
    deliveryValidAgencyId,
    checkoutPickupSlotId,
    checkoutDeliverySlotId,
    checkoutAgencyDeliverySlotId,
    racePickupSlotId,
    raceSlotId,
  ];

  function daysFromNowAtUtc(days: number, hour: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour));
  }

  function dateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function signToken(userId: string): string {
    return jwt.sign(
      { sub: userId, role: 'CLIENT' },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
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
        email: `cart-a-${runId}@lavenet.test`,
        phone: `+22531${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    userB = await prisma.user.create({
      data: {
        fullName: 'Kouadio Yao',
        email: `cart-b-${runId}@lavenet.test`,
        phone: `+22532${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenA = signToken(userA.id);
    tokenB = signToken(userB.id);

    await prisma.serviceCategory.create({
      data: {
        id: categoryId,
        slug: `lavage-cart-test-${runId}`,
        name: 'Lavage (test)',
        position: 999,
      },
    });
    await prisma.articleType.create({
      data: {
        id: articleTypeId,
        slug: `chemise-cart-test-${runId}`,
        name: 'Chemise (test)',
        iconKey: 'shirt',
      },
    });
    await prisma.service.create({
      data: {
        id: kgServiceId,
        categoryId,
        slug: `lavage-au-kilo-cart-test-${runId}`,
        name: 'Lavage au kilo (test)',
        unit: 'KG',
        processingHours: 24,
        priceRules: {
          create: [{ amountXof: 1200, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });
    await prisma.service.create({
      data: {
        id: pieceServiceId,
        categoryId,
        slug: `repassage-cart-test-${runId}`,
        name: 'Repassage (test)',
        unit: 'PIECE',
        processingHours: 48,
        priceRules: {
          create: [
            { articleTypeId, amountXof: 500, effectiveFrom: new Date('2026-01-01T00:00:00Z') },
          ],
        },
      },
    });
    await prisma.service.create({
      data: {
        id: inactiveServiceId,
        categoryId,
        slug: `hors-service-cart-test-${runId}`,
        name: 'Service désactivé (test)',
        unit: 'KG',
        processingHours: 24,
        isActive: false,
        priceRules: {
          create: [{ amountXof: 999, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });
    await prisma.agency.create({
      data: {
        id: agencyId,
        slug: `agence-cart-test-${runId}`,
        name: 'Agence (test)',
        address: 'Cocody (test)',
        openingHours: 'Lundi - Samedi, 8h - 18h',
      },
    });

    // Hours deliberately off the demo seed's grid (prisma/timeslot-data.ts
    // uses 8/10/14/16) so these throwaway fixtures never collide with the
    // rolling window's own (date, startsAt) unique constraint.
    //
    // HOME: pickup day+3 06h-07h; "too early" delivery is 2h after pickup
    // ends (needs >= 48h, the slowest item's processingHours); "valid"
    // delivery is ~74h after.
    await prisma.timeSlot.create({
      data: {
        id: pickupSlotId,
        date: dateOnly(daysFromNowAtUtc(3, 6)),
        startsAt: daysFromNowAtUtc(3, 6),
        endsAt: daysFromNowAtUtc(3, 7),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: deliveryTooEarlyHomeId,
        date: dateOnly(daysFromNowAtUtc(3, 9)),
        startsAt: daysFromNowAtUtc(3, 9),
        endsAt: daysFromNowAtUtc(3, 11),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: deliveryValidHomeId,
        date: dateOnly(daysFromNowAtUtc(6, 9)),
        startsAt: daysFromNowAtUtc(6, 9),
        endsAt: daysFromNowAtUtc(6, 11),
        capacity: 5,
      },
    });
    // AGENCY: dropoff date+2 (anchor = end of that UTC day); "too early"
    // delivery day+4 09h (~33h after anchor, still under 48h); "valid"
    // delivery day+6 13h (~85h after anchor).
    await prisma.timeSlot.create({
      data: {
        id: deliveryTooEarlyAgencyId,
        date: dateOnly(daysFromNowAtUtc(4, 9)),
        startsAt: daysFromNowAtUtc(4, 9),
        endsAt: daysFromNowAtUtc(4, 11),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: deliveryValidAgencyId,
        date: dateOnly(daysFromNowAtUtc(6, 13)),
        startsAt: daysFromNowAtUtc(6, 13),
        endsAt: daysFromNowAtUtc(6, 15),
        capacity: 5,
      },
    });

    // F-CMD-05/07 (increment 4) fixtures below.
    await prisma.service.create({
      data: {
        id: revocableServiceId,
        categoryId,
        slug: `revocable-cart-test-${runId}`,
        name: 'Service révocable (test)',
        unit: 'KG',
        processingHours: 24,
        priceRules: {
          create: [{ amountXof: 1500, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });
    await prisma.address.create({
      data: {
        id: addressAId,
        userId: userA.id,
        label: 'Maison (test)',
        commune: 'Cocody',
        quartier: 'Angré',
        details: 'Portail bleu (test)',
      },
    });
    await prisma.address.create({
      data: {
        id: addressBId,
        userId: userB.id,
        label: 'Maison (test)',
        commune: 'Marcory',
        quartier: 'Zone 4',
        details: 'Immeuble rouge (test)',
      },
    });
    await prisma.address.create({
      data: {
        id: deletedAddressId,
        userId: userA.id,
        label: 'Ancienne adresse (test)',
        commune: 'Cocody',
        quartier: 'Riviera',
        details: 'Adresse supprimée (test)',
        deletedAt: new Date(),
      },
    });

    // Checkout tests need their own slots (day+10/+13), off-grid and past
    // the pickup/slots describe blocks' own day+3..+6 fixtures, so a
    // checkout test can never collide with a slot state an earlier test
    // already relied on.
    await prisma.timeSlot.create({
      data: {
        id: checkoutPickupSlotId,
        date: dateOnly(daysFromNowAtUtc(10, 6)),
        startsAt: daysFromNowAtUtc(10, 6),
        endsAt: daysFromNowAtUtc(10, 7),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: checkoutDeliverySlotId,
        date: dateOnly(daysFromNowAtUtc(13, 9)),
        startsAt: daysFromNowAtUtc(13, 9),
        endsAt: daysFromNowAtUtc(13, 11),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: checkoutAgencyDeliverySlotId,
        date: dateOnly(daysFromNowAtUtc(13, 13)),
        startsAt: daysFromNowAtUtc(13, 13),
        endsAt: daysFromNowAtUtc(13, 15),
        capacity: 5,
      },
    });
    // Concurrency test (CLAUDE.md §4 rule 4): one delivery slot with a
    // single seat, shared by two independently prepared carts racing to
    // check out at the same time.
    await prisma.timeSlot.create({
      data: {
        id: racePickupSlotId,
        date: dateOnly(daysFromNowAtUtc(15, 6)),
        startsAt: daysFromNowAtUtc(15, 6),
        endsAt: daysFromNowAtUtc(15, 7),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: raceSlotId,
        date: dateOnly(daysFromNowAtUtc(17, 9)),
        startsAt: daysFromNowAtUtc(17, 9),
        endsAt: daysFromNowAtUtc(17, 11),
        capacity: 1,
      },
    });
  }, 30_000);

  afterAll(async () => {
    const userIds = [userA.id, userB.id];
    await prisma.slotBooking.deleteMany({ where: { slotId: { in: timeSlotIds } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.address.deleteMany({
      where: { id: { in: [addressAId, addressBId, deletedAddressId] } },
    });
    await prisma.agency.delete({ where: { id: agencyId } });
    await prisma.timeSlot.deleteMany({ where: { id: { in: timeSlotIds } } });
    await prisma.priceRule.deleteMany({
      where: {
        serviceId: { in: [kgServiceId, pieceServiceId, inactiveServiceId, revocableServiceId] },
      },
    });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.articleType.delete({ where: { id: articleTypeId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects every cart route with no token', async () => {
    await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/cart`).expect(401);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .send({ serviceId: kgServiceId, quantity: 1 })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/items/whatever`)
      .send({ quantity: 2 })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart/items/whatever`)
      .expect(401);
    await request(app.getHttpServer()).delete(`/${API_GLOBAL_PREFIX}/cart`).expect(401);
  });

  it('returns an empty cart with no row created when the user has never added anything', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.cart).toEqual({
      id: null,
      items: [],
      subtotalXof: 0,
      hasUnavailablePricing: false,
      pickupType: null,
      agencyId: null,
      agencyDropoffDate: null,
      pickupSlotId: null,
      deliverySlotId: null,
      deliveryAddressId: null,
    });
  });

  it('rejects adding a nonexistent service', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: 'does-not-exist', quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Service introuvable ou indisponible.');
  });

  it('rejects adding a deactivated service', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: inactiveServiceId, quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Service introuvable ou indisponible.');
  });

  it('rejects a PIECE service with no matching article type price rule', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: pieceServiceId, articleTypeId: 'not-a-real-article-type', quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Aucun tarif actif pour cette combinaison service / type d'article.",
    );
  });

  it('rejects malformed input with a French message, not "Validation failed"', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: kgServiceId, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La quantité doit être supérieure à 0.');
  });

  it('adds items, accumulates them in one persistent cart, and computes a live subtotal', async () => {
    const first = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: kgServiceId, quantity: 2 });
    expect(first.status).toBe(201);
    expect(first.body.cart.items).toHaveLength(1);
    expect(first.body.cart.items[0]).toMatchObject({
      serviceId: kgServiceId,
      unit: 'KG',
      quantity: 2,
      unitPriceXof: 1200,
      lineTotalXof: 2400,
    });
    expect(first.body.cart.subtotalXof).toBe(2400);
    const orderId = first.body.cart.id;
    expect(orderId).toBeTruthy();

    const second = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        serviceId: pieceServiceId,
        articleTypeId,
        quantity: 3,
        instructions: 'Repasser sans amidon',
      });
    expect(second.status).toBe(201);
    // Same DRAFT order, not a second one -- "panier persistant par utilisateur".
    expect(second.body.cart.id).toBe(orderId);
    expect(second.body.cart.items).toHaveLength(2);
    expect(second.body.cart.subtotalXof).toBe(2400 + 500 * 3);

    // Persists across a fresh GET, proving it's really stored, not
    // request-scoped state.
    const reread = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(reread.body.cart.id).toBe(orderId);
    expect(reread.body.cart.items).toHaveLength(2);
  });

  it('reflects a price change made after the item was added to the cart', async () => {
    const added = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ serviceId: kgServiceId, quantity: 1 });
    expect(added.body.cart.items[0].unitPriceXof).toBe(1200);

    // Close the current rule and open a new one, same shape a real tariff
    // update would produce (CLAUDE.md §4 rule 2: never overwrite a row).
    await prisma.priceRule.updateMany({
      where: { serviceId: kgServiceId, articleTypeId: null, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    await prisma.priceRule.create({
      data: { serviceId: kgServiceId, amountXof: 1500, effectiveFrom: new Date() },
    });

    const reread = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenB}`);
    const item = reread.body.cart.items.find(
      (i: { serviceId: string }) => i.serviceId === kgServiceId,
    );
    expect(item.unitPriceXof).toBe(1500);

    // Restore for any later test in this file relying on the original price.
    await prisma.priceRule.deleteMany({
      where: { serviceId: kgServiceId, amountXof: 1500 },
    });
    await prisma.priceRule.updateMany({
      where: { serviceId: kgServiceId, articleTypeId: null },
      data: { effectiveTo: null },
    });
  });

  it('marks a line unavailable (null price, flagged) when its service is deactivated after being added', async () => {
    const toggle = await prisma.service.create({
      data: {
        categoryId,
        slug: `toggle-cart-test-${runId}`,
        name: 'À désactiver (test)',
        unit: 'KG',
        processingHours: 24,
        priceRules: {
          create: [{ amountXof: 800, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });

    const added = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ serviceId: toggle.id, quantity: 1 });
    expect(
      added.body.cart.items.find((i: { serviceId: string }) => i.serviceId === toggle.id),
    ).toMatchObject({ unitPriceXof: 800 });

    await prisma.service.update({ where: { id: toggle.id }, data: { isActive: false } });

    const reread = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenB}`);
    const item = reread.body.cart.items.find(
      (i: { serviceId: string }) => i.serviceId === toggle.id,
    );
    expect(item).toMatchObject({ unitPriceXof: null, lineTotalXof: null });
    expect(reread.body.cart.hasUnavailablePricing).toBe(true);
    expect(reread.body.cart.subtotalXof).toBeNull();

    await prisma.priceRule.deleteMany({ where: { serviceId: toggle.id } });
    await prisma.orderItem.deleteMany({ where: { serviceId: toggle.id } });
    await prisma.service.delete({ where: { id: toggle.id } });
  });

  it('updates an owned item and recomputes the subtotal', async () => {
    // Start from a known-empty cart -- tokenA already accumulated items in
    // earlier tests in this file, and this test needs to know exactly
    // which item id it's updating.
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const added = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: kgServiceId, quantity: 1 });
    const itemId = added.body.cart.items.find(
      (i: { serviceId: string }) => i.serviceId === kgServiceId,
    ).id;

    const updated = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ quantity: 5 });
    expect(updated.status).toBe(200);
    const item = updated.body.cart.items.find((i: { id: string }) => i.id === itemId);
    expect(item).toMatchObject({ quantity: 5, unitPriceXof: 1200, lineTotalXof: 6000 });
  });

  it("never lets one account read into or modify another account's cart (IDOR)", async () => {
    // Known-empty starting point, same reason as the previous test.
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const created = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: kgServiceId, quantity: 1 });
    const itemId = created.body.cart.items.find(
      (i: { serviceId: string }) => i.serviceId === kgServiceId,
    ).id;

    const updateAttempt = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ quantity: 99 });
    expect(updateAttempt.status).toBe(404);

    const removeAttempt = await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(removeAttempt.status).toBe(404);

    // userA's item survives both attempts, untouched.
    const stillThere = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`);
    const item = stillThere.body.cart.items.find((i: { id: string }) => i.id === itemId);
    expect(item).toMatchObject({ quantity: 1 });
  });

  it('rejects updating or deleting an item id that does not exist at all', async () => {
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/items/does-not-exist`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ quantity: 2 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart/items/does-not-exist`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('removes a single item, leaving the rest of the cart untouched', async () => {
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const kg = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: kgServiceId, quantity: 1 });
    const piece = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ serviceId: pieceServiceId, articleTypeId, quantity: 1 });
    const kgItemId = kg.body.cart.items.find(
      (i: { serviceId: string }) => i.serviceId === kgServiceId,
    ).id;
    expect(piece.body.cart.items).toHaveLength(2);

    const removed = await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart/items/${kgItemId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(removed.status).toBe(200);
    expect(removed.body.cart.items).toHaveLength(1);
    expect(removed.body.cart.items[0].serviceId).toBe(pieceServiceId);
  });

  it('clears every item but keeps the same cart id (empty, not gone)', async () => {
    const before = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(before.body.cart.items.length).toBeGreaterThan(0);
    const orderId = before.body.cart.id;

    const cleared = await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(cleared.status).toBe(200);
    expect(cleared.body.cart).toEqual({
      id: orderId,
      items: [],
      subtotalXof: 0,
      hasUnavailablePricing: false,
      pickupType: null,
      agencyId: null,
      agencyDropoffDate: null,
      pickupSlotId: null,
      deliverySlotId: null,
      deliveryAddressId: null,
    });
  });

  it('clearing an already-empty cart is a no-op, not an error', async () => {
    // tokenB may or may not have a DRAFT order from earlier tests in this
    // file -- either way, clearing twice in a row must both return 200,
    // proving the second call (nothing left, possibly no row at all) never
    // errors.
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const res = await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
  });

  describe('pickup mode (F-CMD-03)', () => {
    function isoDateDaysFromNow(days: number): string {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    }

    it('rejects every pickup route with no token', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .send({ pickupType: 'HOME' })
        .expect(401);
    });

    it('rejects setting a pickup mode with no cart yet', async () => {
      // tokenB's cart was cleared (not deleted) by an earlier test in this
      // file, so exercise the true "never had a cart" case with a fresh
      // throwaway user instead.
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Panier',
          email: `cart-fresh-${runId}@lavenet.test`,
          phone: `+22533${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ pickupType: 'HOME' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Panier introuvable.');

      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    it('sets HOME pickup on an existing cart', async () => {
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ serviceId: kgServiceId, quantity: 1 });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'HOME' });
      expect(res.status).toBe(200);
      expect(res.body.cart.pickupType).toBe('HOME');
      expect(res.body.cart.agencyId).toBeNull();
      expect(res.body.cart.agencyDropoffDate).toBeNull();
    });

    it('sets AGENCY pickup with a valid agency and a future drop-off date', async () => {
      const dropoffDate = isoDateDaysFromNow(3);
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'AGENCY', agencyId, agencyDropoffDate: dropoffDate });
      expect(res.status).toBe(200);
      expect(res.body.cart.pickupType).toBe('AGENCY');
      expect(res.body.cart.agencyId).toBe(agencyId);
      expect(res.body.cart.agencyDropoffDate).toBe(dropoffDate);
    });

    it('accepts a drop-off date of today', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'AGENCY', agencyId, agencyDropoffDate: isoDateDaysFromNow(0) });
      expect(res.status).toBe(200);
      expect(res.body.cart.agencyDropoffDate).toBe(isoDateDaysFromNow(0));
    });

    it('rejects a drop-off date in the past', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'AGENCY', agencyId, agencyDropoffDate: isoDateDaysFromNow(-1) });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('La date de dépôt en agence ne peut pas être dans le passé.');
    });

    it('rejects an unknown agency', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          pickupType: 'AGENCY',
          agencyId: 'does-not-exist',
          agencyDropoffDate: isoDateDaysFromNow(1),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Agence introuvable.');
    });

    it('rejects AGENCY without an agencyId, with a French message', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'AGENCY', agencyDropoffDate: isoDateDaysFromNow(1) });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown pickupType', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'OFFICE' });
      expect(res.status).toBe(400);
    });

    it("keeps each user's pickup mode isolated from the other's cart (IDOR)", async () => {
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ serviceId: kgServiceId, quantity: 1 });
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ pickupType: 'HOME' })
        .expect(200);

      // userA's cart, set to AGENCY in an earlier test, is untouched by
      // userB's HOME selection above -- no shared state, no cross-user id
      // ever accepted from the request body (userId always comes from the
      // token, never a param).
      const aCart = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(aCart.body.cart.pickupType).toBe('AGENCY');

      const bCart = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(bCart.body.cart.pickupType).toBe('HOME');
    });
  });

  describe('slots (F-CMD-04)', () => {
    // Known-empty cart, both a KG (24h) and a PIECE (48h) item -- the
    // slowest, 48h, is what the min-delivery rule must use. `pickup`
    // is either { pickupType: 'HOME' } or an AGENCY body; passed straight
    // through to PATCH /cart/pickup.
    async function resetCartWithPickup(token: string, pickup: Record<string, unknown>) {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: kgServiceId, quantity: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: pieceServiceId, articleTypeId, quantity: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${token}`)
        .send(pickup)
        .expect(200);
    }

    it('rejects every slots route with no token', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .send({ deliverySlotId: deliveryValidHomeId })
        .expect(401);
    });

    it('rejects setting slots before a pickup mode is chosen', async () => {
      // tokenA/tokenB both already have a pickup mode set by earlier tests
      // in this file, and DELETE /cart only clears items, never pickup
      // state (by design -- see clearCart) -- so a fresh, never-touched
      // user is the only way to exercise "no pickup mode chosen yet".
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Créneau',
          email: `cart-noslot-${runId}@lavenet.test`,
          phone: `+22534${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ serviceId: kgServiceId, quantity: 1 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ deliverySlotId: deliveryValidHomeId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Choisissez d'abord un mode de retrait.");

      await prisma.orderItem.deleteMany({ where: { order: { userId: freshUser.id } } });
      await prisma.order.deleteMany({ where: { userId: freshUser.id } });
      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    it('rejects setting slots on an empty cart', async () => {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'HOME' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deliverySlotId: deliveryValidHomeId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Le panier est vide.');
    });

    it('rejects HOME pickup with no pickupSlotId', async () => {
      await resetCartWithPickup(tokenA, { pickupType: 'HOME' });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deliverySlotId: deliveryValidHomeId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Créneau de retrait requis.');
    });

    it('rejects a delivery slot earlier than pickup + the slowest processing time (HOME)', async () => {
      await resetCartWithPickup(tokenA, { pickupType: 'HOME' });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupSlotId, deliverySlotId: deliveryTooEarlyHomeId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'Le créneau de livraison choisi est trop proche du retrait pour le temps de traitement requis.',
      );
    });

    it('sets a HOME pickup/delivery slot pair that satisfies the minimum delay', async () => {
      await resetCartWithPickup(tokenA, { pickupType: 'HOME' });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupSlotId, deliverySlotId: deliveryValidHomeId });
      expect(res.status).toBe(200);
      expect(res.body.cart.pickupSlotId).toBe(pickupSlotId);
      expect(res.body.cart.deliverySlotId).toBe(deliveryValidHomeId);
    });

    it('rejects an AGENCY body carrying a pickupSlotId', async () => {
      await resetCartWithPickup(tokenA, {
        pickupType: 'AGENCY',
        agencyId,
        agencyDropoffDate: isoDate(daysFromNowAtUtc(2, 0)),
      });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupSlotId, deliverySlotId: deliveryValidAgencyId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Un dépôt en agence n'utilise pas de créneau de retrait.");
    });

    it('rejects a delivery slot earlier than the drop-off date + the slowest processing time (AGENCY)', async () => {
      await resetCartWithPickup(tokenA, {
        pickupType: 'AGENCY',
        agencyId,
        agencyDropoffDate: isoDate(daysFromNowAtUtc(2, 0)),
      });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deliverySlotId: deliveryTooEarlyAgencyId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'Le créneau de livraison choisi est trop proche du retrait pour le temps de traitement requis.',
      );
    });

    it('sets an AGENCY delivery slot that satisfies the minimum delay anchored on the drop-off date', async () => {
      await resetCartWithPickup(tokenA, {
        pickupType: 'AGENCY',
        agencyId,
        agencyDropoffDate: isoDate(daysFromNowAtUtc(2, 0)),
      });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deliverySlotId: deliveryValidAgencyId });
      expect(res.status).toBe(200);
      expect(res.body.cart.pickupSlotId).toBeNull();
      expect(res.body.cart.deliverySlotId).toBe(deliveryValidAgencyId);
    });

    it('rejects an unknown delivery slot id', async () => {
      await resetCartWithPickup(tokenA, { pickupType: 'HOME' });

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupSlotId, deliverySlotId: 'does-not-exist' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Créneau de livraison introuvable.');
    });

    it("keeps each user's slot selection isolated from the other's cart (IDOR)", async () => {
      // Nine sequential DB-touching requests (two full resetCartWithPickup
      // calls plus four more) -- comfortably needs more than the file's
      // default 15s testTimeout even without any DB latency degradation.
      await resetCartWithPickup(tokenA, { pickupType: 'HOME' });
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupSlotId, deliverySlotId: deliveryValidHomeId })
        .expect(200);

      await resetCartWithPickup(tokenB, {
        pickupType: 'AGENCY',
        agencyId,
        agencyDropoffDate: isoDate(daysFromNowAtUtc(2, 0)),
      });
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ deliverySlotId: deliveryValidAgencyId })
        .expect(200);

      const aCart = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(aCart.body.cart.deliverySlotId).toBe(deliveryValidHomeId);

      const bCart = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(bCart.body.cart.deliverySlotId).toBe(deliveryValidAgencyId);
      expect(bCart.body.cart.pickupSlotId).toBeNull();
    }, 45_000);
  });

  describe('delivery address (F-CMD-05)', () => {
    it('rejects the address route with no token', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .send({ addressId: addressAId })
        .expect(401);
    });

    it('rejects setting a delivery address with no cart yet', async () => {
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Adresse',
          email: `cart-noaddr-${runId}@lavenet.test`,
          phone: `+22535${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ addressId: addressAId });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Panier introuvable.');

      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    it('sets a delivery address on an existing cart', async () => {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ serviceId: kgServiceId, quantity: 1 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ addressId: addressAId });
      expect(res.status).toBe(200);
      expect(res.body.cart.deliveryAddressId).toBe(addressAId);
    });

    it('rejects an unknown address id', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ addressId: 'does-not-exist' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Adresse introuvable.');
    });

    it('rejects an address belonging to another user (IDOR), with the same message as unknown', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ addressId: addressBId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Adresse introuvable.');
    });

    it('rejects a soft-deleted address', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ addressId: deletedAddressId });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Adresse introuvable.');
    });

    it("keeps each user's delivery-address selection isolated from the other's cart (IDOR)", async () => {
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ serviceId: kgServiceId, quantity: 1 });
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ addressId: addressBId })
        .expect(200);

      const aCart = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(aCart.body.cart.deliveryAddressId).toBe(addressAId);

      const bCart = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(bCart.body.cart.deliveryAddressId).toBe(addressBId);
    });
  });

  describe('checkout (F-CMD-05/07)', () => {
    // Quantity 2 of the 1200 XOF/kg service (2400 XOF) is deliberately
    // above MIN_ORDER_XOF (2000) and below FREE_DELIVERY_THRESHOLD_XOF
    // (10000) -- a checkout expected to succeed under the HOME minimum-
    // order rule, while still owing the flat delivery fee.
    async function prepareHomeCart(
      token: string,
      opts: { addressId: string; pickupSlotId: string; deliverySlotId: string; quantity?: number },
    ) {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: kgServiceId, quantity: opts.quantity ?? 2 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupType: 'HOME' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pickupSlotId: opts.pickupSlotId, deliverySlotId: opts.deliverySlotId })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${token}`)
        .send({ addressId: opts.addressId })
        .expect(200);
    }

    it('rejects checkout with no token', async () => {
      await request(app.getHttpServer()).post(`/${API_GLOBAL_PREFIX}/cart/checkout`).expect(401);
    });

    it('rejects checkout with no cart yet', async () => {
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Commande',
          email: `cart-nocheckout-${runId}@lavenet.test`,
          phone: `+22538${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send();
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Panier introuvable.');

      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    it('rejects checkout on an empty cart', async () => {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Le panier est vide.');
    });

    it('rejects checkout before a pickup mode is chosen', async () => {
      // tokenA already has a pickup mode set from earlier tests in this
      // file (PATCH /cart/pickup, once set, is never cleared by DELETE
      // /cart) -- only a fresh, never-touched user can exercise "no pickup
      // mode chosen yet", same reasoning as the pickup-mode/slots describe
      // blocks' own fresh-user tests.
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Mode De Retrait',
          email: `cart-nopickup-${runId}@lavenet.test`,
          phone: `+22540${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ serviceId: kgServiceId, quantity: 2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Choisissez d'abord un mode de retrait.");

      await prisma.orderItem.deleteMany({ where: { order: { userId: freshUser.id } } });
      await prisma.order.deleteMany({ where: { userId: freshUser.id } });
      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    it('rejects checkout before a delivery slot is chosen', async () => {
      // A fresh user, not tokenA: tokenA's order carries a *stale*
      // deliverySlotId left over from an earlier describe block in this
      // file (PATCH /cart/slots values are never cleared by DELETE /cart
      // or by switching pickup mode -- see the "stale AGENCY selection"
      // test below), which would satisfy this check by accident and mask
      // what this test is meant to prove. Only a user who has never called
      // PATCH /cart/slots at all guarantees a genuinely null deliverySlotId.
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Creneau Livraison',
          email: `cart-nodeliveryslot-${runId}@lavenet.test`,
          phone: `+22541${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ serviceId: kgServiceId, quantity: 2 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ pickupType: 'HOME' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Choisissez un créneau de livraison.');

      await prisma.orderItem.deleteMany({ where: { order: { userId: freshUser.id } } });
      await prisma.order.deleteMany({ where: { userId: freshUser.id } });
      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    // Regression guard for a real inconsistency: PATCH /cart/pickup never
    // clears pickupSlotId/deliverySlotId when switching modes (by design,
    // see cart.service.ts), so a client can reach checkout with a delivery
    // slot chosen under AGENCY and no pickupSlotId at all after switching
    // back to HOME. Checkout must catch this itself, not trust the cart's
    // already-saved state.
    it('rejects checkout when HOME has a delivery slot but no pickup slot (stale AGENCY selection)', async () => {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ serviceId: kgServiceId, quantity: 2 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          pickupType: 'AGENCY',
          agencyId,
          agencyDropoffDate: isoDate(daysFromNowAtUtc(2, 0)),
        })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deliverySlotId: checkoutAgencyDeliverySlotId })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'HOME' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Choisissez un créneau de retrait.');
    }, 30_000);

    it('rejects checkout before a delivery address is chosen', async () => {
      // A fresh user, not tokenA: tokenA's order already has a
      // deliveryAddressId from the delivery-address describe block above
      // (PATCH /cart/address, once set, is never cleared by DELETE /cart
      // either) -- only a never-touched user guarantees a genuinely null
      // deliveryAddressId, same reasoning as the two fresh-user tests above.
      const freshUser = await prisma.user.create({
        data: {
          fullName: 'Sans Adresse De Livraison',
          email: `cart-nocheckoutaddr-${runId}@lavenet.test`,
          phone: `+22542${phoneDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const freshToken = signToken(freshUser.id);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ serviceId: kgServiceId, quantity: 2 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ pickupType: 'HOME' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ pickupSlotId: checkoutPickupSlotId, deliverySlotId: checkoutDeliverySlotId })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Choisissez une adresse de livraison.');

      await prisma.orderItem.deleteMany({ where: { order: { userId: freshUser.id } } });
      await prisma.order.deleteMany({ where: { userId: freshUser.id } });
      await prisma.user.delete({ where: { id: freshUser.id } });
    });

    it('rejects HOME checkout below the minimum order, suggesting AGENCY (docs/ADR/0006)', async () => {
      await prepareHomeCart(tokenA, {
        addressId: addressAId,
        pickupSlotId: checkoutPickupSlotId,
        deliverySlotId: checkoutDeliverySlotId,
        quantity: 1, // 1200 XOF, below MIN_ORDER_XOF (2000)
      });

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Montant minimum');
      expect(res.body.message).toContain('dépôt en agence');
    }, 30_000);

    it('rejects checkout when a cart line is no longer available', async () => {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ serviceId: revocableServiceId, quantity: 2 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupType: 'HOME' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pickupSlotId: checkoutPickupSlotId, deliverySlotId: checkoutDeliverySlotId })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ addressId: addressAId })
        .expect(200);

      await prisma.service.update({ where: { id: revocableServiceId }, data: { isActive: false } });

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'Certains articles de votre panier ne sont plus disponibles. Retirez-les avant de valider votre commande.',
      );
    }, 30_000);

    it('checks out a HOME order: freezes prices/totals, books both slots, issues a readable reference', async () => {
      await prepareHomeCart(tokenA, {
        addressId: addressAId,
        pickupSlotId: checkoutPickupSlotId,
        deliverySlotId: checkoutDeliverySlotId,
      });

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(200);
      const { order } = res.body;
      expect(order.reference).toMatch(/^LN-\d{4}-\d{6,}$/);
      expect(order.status).toBe('PENDING_PICKUP');
      expect(order.pickupType).toBe('HOME');
      expect(order.pickupSlotId).toBe(checkoutPickupSlotId);
      expect(order.deliverySlotId).toBe(checkoutDeliverySlotId);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].unitPriceXof).toBe(1200);
      expect(order.items[0].lineTotalXof).toBe(2400);
      expect(order.subtotalXof).toBe(2400);
      expect(order.discountXof).toBe(0);
      expect(order.deliveryFeeXof).toBe(1000);
      expect(order.vatRateBps).toBe(0);
      expect(order.vatAmountXof).toBe(0);
      expect(order.totalXof).toBe(3400);
      expect(order.deliveryCommune).toBe('Cocody');
      expect(order.deliveryQuartier).toBe('Angré');
      expect(order.deliveryDetails).toBe('Portail bleu (test)');

      const pickupSlot = await prisma.timeSlot.findUniqueOrThrow({
        where: { id: checkoutPickupSlotId },
      });
      expect(pickupSlot.bookedCount).toBe(1);
      const deliverySlot = await prisma.timeSlot.findUniqueOrThrow({
        where: { id: checkoutDeliverySlotId },
      });
      expect(deliverySlot.bookedCount).toBe(1);
    }, 30_000);

    it('leaves no DRAFT cart behind after checkout -- a second checkout finds nothing to validate', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Panier introuvable.');
    });

    it('checks out an AGENCY order below the minimum order -- MIN_ORDER_XOF only gates HOME', async () => {
      await request(app.getHttpServer())
        .delete(`/${API_GLOBAL_PREFIX}/cart`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/items`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ serviceId: kgServiceId, quantity: 1 }) // 1200 XOF, below MIN_ORDER_XOF
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          pickupType: 'AGENCY',
          agencyId,
          agencyDropoffDate: isoDate(daysFromNowAtUtc(2, 0)),
        })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ deliverySlotId: checkoutAgencyDeliverySlotId })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ addressId: addressBId })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.order.pickupType).toBe('AGENCY');
      expect(res.body.order.pickupSlotId).toBeNull();
      expect(res.body.order.deliverySlotId).toBe(checkoutAgencyDeliverySlotId);
      expect(res.body.order.subtotalXof).toBe(1200);
    }, 30_000);

    it('books at most one of two simultaneous checkouts for the last seat of a shared delivery slot', async () => {
      const raceDigits = Date.now().toString().slice(-8);
      const userRaceA = await prisma.user.create({
        data: {
          fullName: 'Course A',
          email: `cart-race-a-${runId}@lavenet.test`,
          phone: `+22539${raceDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const userRaceB = await prisma.user.create({
        data: {
          fullName: 'Course B',
          email: `cart-race-b-${runId}@lavenet.test`,
          phone: `+22530${raceDigits}`,
          passwordHash: await hash(PASSWORD),
          phoneVerifiedAt: new Date(),
        },
      });
      const tokenRaceA = signToken(userRaceA.id);
      const tokenRaceB = signToken(userRaceB.id);
      const raceAddressA = await prisma.address.create({
        data: {
          userId: userRaceA.id,
          label: 'Course',
          commune: 'Cocody',
          quartier: 'Angré',
          details: 'Course A (test)',
        },
      });
      const raceAddressB = await prisma.address.create({
        data: {
          userId: userRaceB.id,
          label: 'Course',
          commune: 'Cocody',
          quartier: 'Angré',
          details: 'Course B (test)',
        },
      });

      await prepareHomeCart(tokenRaceA, {
        addressId: raceAddressA.id,
        pickupSlotId: racePickupSlotId,
        deliverySlotId: raceSlotId,
      });
      await prepareHomeCart(tokenRaceB, {
        addressId: raceAddressB.id,
        pickupSlotId: racePickupSlotId,
        deliverySlotId: raceSlotId,
      });

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
          .set('Authorization', `Bearer ${tokenRaceA}`)
          .send(),
        request(app.getHttpServer())
          .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
          .set('Authorization', `Bearer ${tokenRaceB}`)
          .send(),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);
      const winner = resA.status === 200 ? resA : resB;
      const loser = resA.status === 200 ? resB : resA;
      expect(winner.body.order.deliverySlotId).toBe(raceSlotId);
      expect(loser.body.message).toContain('complété');

      // The DB, not the HTTP responses, is the real guarantee (CLAUDE.md §4
      // rule 4): exactly one seat booked, capacity never exceeded, and the
      // loser's *own* pickup-slot booking was rolled back too, not left
      // dangling from the same failed transaction.
      const deliverySlot = await prisma.timeSlot.findUniqueOrThrow({ where: { id: raceSlotId } });
      expect(deliverySlot.bookedCount).toBe(1);
      const deliveryBookings = await prisma.slotBooking.findMany({ where: { slotId: raceSlotId } });
      expect(deliveryBookings).toHaveLength(1);
      const pickupSlot = await prisma.timeSlot.findUniqueOrThrow({
        where: { id: racePickupSlotId },
      });
      expect(pickupSlot.bookedCount).toBe(1);

      await prisma.user.delete({ where: { id: userRaceA.id } });
      await prisma.user.delete({ where: { id: userRaceB.id } });
    }, 45_000);
  });
});
