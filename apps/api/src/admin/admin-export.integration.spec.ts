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

// Real HTTP + real database. Checked by looking for specific known
// strings (this run's own reference, its DRAFT sibling) rather than
// asserting an exact row count -- the export scans the whole date window
// across every client, so a shared dev database can hold other orders in
// it too (same reasoning as admin-dashboard.integration.spec.ts).
describe('Admin CSV export (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let adminUser: { id: string };
  let clientUser: { id: string };
  let tokenAdmin: string;
  let tokenClient: string;

  const categoryId = `cat-export-test-${runId}`;
  const serviceId = `svc-export-test-${runId}`;
  const placedReference = `LN-TEST-${runId}-PLACED`;
  const draftReference = `LN-TEST-${runId}-DRAFT`;
  let placedOrderId: string;
  let draftOrderId: string;
  let paymentId: string;

  const today = new Date().toISOString().slice(0, 10);

  function signToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    adminUser = await prisma.user.create({
      data: {
        fullName: 'Admin Test',
        email: `export-admin-${runId}@lavenet.test`,
        phone: `+22543${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'ADMIN',
      },
    });
    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Été', // deliberately accented, tests real UTF-8 output
        email: `export-client-${runId}@lavenet.test`,
        phone: `+22544${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenAdmin = signToken(adminUser.id, 'ADMIN');
    tokenClient = signToken(clientUser.id, 'CLIENT');

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-export-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: { id: serviceId, categoryId, slug: `lavage-export-${runId}`, name: 'Nettoyage; "Spécial"', unit: 'KG', processingHours: 24 },
    });

    const placedOrder = await prisma.order.create({
      data: {
        userId: clientUser.id,
        status: 'PENDING_PICKUP',
        reference: placedReference,
        pickupType: 'HOME',
        deliveryCommune: 'Cocody',
        deliveryQuartier: 'Angré',
        deliveryDetails: 'Portail bleu (test)',
        subtotalXof: 3400,
        discountXof: 0,
        deliveryFeeXof: 1000,
        vatRateBps: 0,
        vatAmountXof: 0,
        totalXof: 3400,
        items: { create: [{ serviceId, quantity: 1, unitPriceXof: 3400 }] },
        payment: { create: { provider: 'CASH', status: 'PENDING', amountXof: 3400, idempotencyKey: randomUUID() } },
      },
      include: { payment: true },
    });
    placedOrderId = placedOrder.id;
    paymentId = placedOrder.payment!.id;

    const draftOrder = await prisma.order.create({
      data: { userId: clientUser.id, status: 'DRAFT', reference: draftReference },
    });
    draftOrderId = draftOrder.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { id: paymentId } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: [placedOrderId, draftOrderId] } } });
    await prisma.order.deleteMany({ where: { id: { in: [placedOrderId, draftOrderId] } } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, clientUser.id] } } });
    await app.close();
  });

  it('rejects a CLIENT token with 403 on both export routes', async () => {
    await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/export/orders?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/export/payments?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .expect(403);
  });

  it('exports orders as CSV with a BOM, correct headers, accents, and no DRAFT row', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/export/orders?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const body: Buffer = res.body;
    // UTF-8 BOM is the three bytes EF BB BF.
    expect(body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));

    const text = body.toString('utf8');
    expect(text.split('\r\n')[0]).toBe(
      '﻿Référence;Date;Statut;Client;Téléphone;Mode de retrait;Sous-total (XOF);Livraison (XOF);TVA (XOF);Total (XOF)',
    );
    expect(text).toContain(placedReference);
    expect(text).toContain('Client Été');
    expect(text).not.toContain(draftReference);
  });

  it('exports payments as CSV referencing the order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/export/payments?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain(placedReference);
    expect(res.text).toContain('CASH');
  });

  it('rejects a malformed date range', async () => {
    await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/export/orders?from=not-a-date&to=${today}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(400);
  });
});
