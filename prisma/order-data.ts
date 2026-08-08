import type { PrismaClient } from '@prisma/client';

// Shared by prisma/seed.ts (fresh-database demo seed) and
// prisma/seed-demo-orders.ts (idempotent, safe to rerun against
// production -- same convention as catalog-data.ts/agency-data.ts).
//
// F-CMD-09/F-STA + CLAUDE.md §10's seed commitment: ~25 orders spread
// across every placed status and 60 days, so the history list, the
// progression frise and a future dashboard all have something real to
// show. Orders are inserted directly via Prisma rather than driven
// through checkout/the state machine's HTTP surface (which today only
// ever produces DRAFT -> PENDING_PICKUP, plus client cancellation) --
// legitimate for seed data, same as every other prisma/*-data.ts
// generator writes rows directly instead of replaying real user actions.
//
// Idempotency key: a deterministic reference (LN-DEMO-NNN), not
// order_reference_seq -- consuming real sequence numbers here would make
// a rerun create 25 *more* orders instead of upserting the same 25.
// Upserted by that unique reference.

const DELIVERY_FEE_XOF = 1000;
const FREE_DELIVERY_THRESHOLD_XOF = 10_000;

interface BasketItem {
  serviceSlug: string;
  articleTypeSlug?: string;
  quantity: number;
  unitPriceXof: number;
}

// Prices match the *current* row in catalog-data.ts's PriceRule history
// (post-HISTORY_SWITCH) -- frozen here the same way checkout freezes them,
// just resolved by hand instead of at request time.
const BASKETS: readonly BasketItem[][] = [
  [{ serviceSlug: 'lavage-au-kilo', quantity: 3, unitPriceXof: 1200 }],
  [
    {
      serviceSlug: 'repassage-a-la-piece',
      articleTypeSlug: 'chemise',
      quantity: 2,
      unitPriceXof: 500,
    },
    {
      serviceSlug: 'repassage-a-la-piece',
      articleTypeSlug: 'pantalon',
      quantity: 1,
      unitPriceXof: 500,
    },
  ],
  [{ serviceSlug: 'lavage-repassage-au-kilo', quantity: 2, unitPriceXof: 1800 }],
  [
    {
      serviceSlug: 'pressing-costume',
      articleTypeSlug: 'costume-2p',
      quantity: 1,
      unitPriceXof: 4000,
    },
  ],
  [{ serviceSlug: 'nettoyage-couette', quantity: 1, unitPriceXof: 6000 }],
  [
    {
      serviceSlug: 'repassage-a-la-piece',
      articleTypeSlug: 'tshirt',
      quantity: 3,
      unitPriceXof: 400,
    },
  ],
  [{ serviceSlug: 'nettoyage-chaussures', quantity: 2, unitPriceXof: 2500 }],
  [
    {
      serviceSlug: 'pressing-robe-de-soiree',
      articleTypeSlug: 'robe',
      quantity: 1,
      unitPriceXof: 4500,
    },
  ],
];

const DELIVERY_ADDRESSES = [
  { commune: 'Cocody', quartier: 'Angré', details: 'Immeuble Les Palmiers, 3e étage' },
  { commune: 'Marcory', quartier: 'Zone 4', details: 'Villa 12, rue des Jardins' },
  { commune: 'Yopougon', quartier: 'Niangon', details: 'Portail vert, après la pharmacie' },
  { commune: 'Plateau', quartier: 'Rue du Commerce', details: 'Tour Alpha 2000, 5e étage' },
  { commune: 'Abobo', quartier: 'Avocatier', details: 'Maison bleue, face au marché' },
] as const;

type PlacedStatus =
  | 'PENDING_PICKUP'
  | 'PICKED_UP'
  | 'PROCESSING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ON_HOLD';

interface OrderSpec {
  reference: string;
  daysAgo: number;
  status: PlacedStatus;
  pickupType: 'HOME' | 'AGENCY';
  basketIndex: number;
  addressIndex: number;
}

// Hand-authored, not generated: 10 DELIVERED (the common case, so 60-day
// stats have a real backbone), 3 CANCELLED, and a spread of every
// in-progress status. daysAgo values are all distinct enough that the
// slots they resolve to (see below) rarely collide, though sharing one is
// harmless -- multiple demo orders picked up in the same window is
// realistic, not a bug.
const ORDER_SPECS: OrderSpec[] = [
  {
    reference: 'LN-DEMO-001',
    daysAgo: 58,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 0,
    addressIndex: 0,
  },
  {
    reference: 'LN-DEMO-002',
    daysAgo: 52,
    status: 'DELIVERED',
    pickupType: 'AGENCY',
    basketIndex: 1,
    addressIndex: 1,
  },
  {
    reference: 'LN-DEMO-003',
    daysAgo: 47,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 2,
    addressIndex: 2,
  },
  {
    reference: 'LN-DEMO-004',
    daysAgo: 43,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 3,
    addressIndex: 3,
  },
  {
    reference: 'LN-DEMO-005',
    daysAgo: 38,
    status: 'DELIVERED',
    pickupType: 'AGENCY',
    basketIndex: 4,
    addressIndex: 4,
  },
  {
    reference: 'LN-DEMO-006',
    daysAgo: 33,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 5,
    addressIndex: 0,
  },
  {
    reference: 'LN-DEMO-007',
    daysAgo: 29,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 6,
    addressIndex: 1,
  },
  {
    reference: 'LN-DEMO-008',
    daysAgo: 24,
    status: 'DELIVERED',
    pickupType: 'AGENCY',
    basketIndex: 7,
    addressIndex: 2,
  },
  {
    reference: 'LN-DEMO-009',
    daysAgo: 19,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 0,
    addressIndex: 3,
  },
  {
    reference: 'LN-DEMO-010',
    daysAgo: 14,
    status: 'DELIVERED',
    pickupType: 'HOME',
    basketIndex: 1,
    addressIndex: 4,
  },
  {
    reference: 'LN-DEMO-011',
    daysAgo: 40,
    status: 'CANCELLED',
    pickupType: 'HOME',
    basketIndex: 2,
    addressIndex: 0,
  },
  {
    reference: 'LN-DEMO-012',
    daysAgo: 25,
    status: 'CANCELLED',
    pickupType: 'AGENCY',
    basketIndex: 3,
    addressIndex: 1,
  },
  {
    reference: 'LN-DEMO-013',
    daysAgo: 10,
    status: 'CANCELLED',
    pickupType: 'HOME',
    basketIndex: 4,
    addressIndex: 2,
  },
  {
    reference: 'LN-DEMO-014',
    daysAgo: 3,
    status: 'PROCESSING',
    pickupType: 'HOME',
    basketIndex: 5,
    addressIndex: 3,
  },
  {
    reference: 'LN-DEMO-015',
    daysAgo: 2,
    status: 'PROCESSING',
    pickupType: 'AGENCY',
    basketIndex: 6,
    addressIndex: 4,
  },
  {
    reference: 'LN-DEMO-016',
    daysAgo: 1,
    status: 'PROCESSING',
    pickupType: 'HOME',
    basketIndex: 7,
    addressIndex: 0,
  },
  {
    reference: 'LN-DEMO-017',
    daysAgo: 4,
    status: 'READY',
    pickupType: 'HOME',
    basketIndex: 0,
    addressIndex: 1,
  },
  {
    reference: 'LN-DEMO-018',
    daysAgo: 2,
    status: 'READY',
    pickupType: 'AGENCY',
    basketIndex: 1,
    addressIndex: 2,
  },
  {
    reference: 'LN-DEMO-019',
    daysAgo: 1,
    status: 'OUT_FOR_DELIVERY',
    pickupType: 'HOME',
    basketIndex: 2,
    addressIndex: 3,
  },
  {
    reference: 'LN-DEMO-020',
    daysAgo: 0,
    status: 'OUT_FOR_DELIVERY',
    pickupType: 'HOME',
    basketIndex: 3,
    addressIndex: 4,
  },
  {
    reference: 'LN-DEMO-021',
    daysAgo: 2,
    status: 'PICKED_UP',
    pickupType: 'AGENCY',
    basketIndex: 4,
    addressIndex: 0,
  },
  {
    reference: 'LN-DEMO-022',
    daysAgo: 1,
    status: 'PICKED_UP',
    pickupType: 'HOME',
    basketIndex: 5,
    addressIndex: 1,
  },
  {
    reference: 'LN-DEMO-023',
    daysAgo: 1,
    status: 'PENDING_PICKUP',
    pickupType: 'HOME',
    basketIndex: 6,
    addressIndex: 2,
  },
  {
    reference: 'LN-DEMO-024',
    daysAgo: 0,
    status: 'PENDING_PICKUP',
    pickupType: 'AGENCY',
    basketIndex: 7,
    addressIndex: 3,
  },
  {
    reference: 'LN-DEMO-025',
    daysAgo: 6,
    status: 'ON_HOLD',
    pickupType: 'HOME',
    basketIndex: 0,
    addressIndex: 4,
  },
];

// Every status the happy path passes through on its way to `status`,
// paired with the OrderStatusHistory row that gets it there -- CANCELLED
// and ON_HOLD branch off instead of continuing the sequence.
function historyFor(
  status: PlacedStatus,
): { fromStatus: 'DRAFT' | PlacedStatus; toStatus: PlacedStatus; reason: string | null }[] {
  const HAPPY_PATH: PlacedStatus[] = [
    'PENDING_PICKUP',
    'PICKED_UP',
    'PROCESSING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ];
  if (status === 'CANCELLED') {
    return [
      { fromStatus: 'DRAFT', toStatus: 'PENDING_PICKUP', reason: null },
      { fromStatus: 'PENDING_PICKUP', toStatus: 'CANCELLED', reason: null },
    ];
  }
  if (status === 'ON_HOLD') {
    return [
      { fromStatus: 'DRAFT', toStatus: 'PENDING_PICKUP', reason: null },
      { fromStatus: 'PENDING_PICKUP', toStatus: 'PICKED_UP', reason: null },
      { fromStatus: 'PICKED_UP', toStatus: 'PROCESSING', reason: null },
      {
        fromStatus: 'PROCESSING',
        toStatus: 'ON_HOLD',
        reason: 'Vêtement taché -- en attente de confirmation du client',
      },
    ];
  }
  const targetIndex = HAPPY_PATH.indexOf(status);
  const entries: { fromStatus: 'DRAFT' | PlacedStatus; toStatus: PlacedStatus; reason: null }[] =
    [];
  for (let i = 0; i <= targetIndex; i += 1) {
    entries.push({
      fromStatus: i === 0 ? 'DRAFT' : HAPPY_PATH[i - 1],
      toStatus: HAPPY_PATH[i],
      reason: null,
    });
  }
  return entries;
}

function daysAgoAt(daysAgo: number, hour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour));
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function findOrCreateSlot(prisma: PrismaClient, date: Date, startsAt: Date, endsAt: Date) {
  const existing = await prisma.timeSlot.findUnique({
    where: { date_startsAt: { date, startsAt } },
  });
  if (existing) {
    return existing;
  }
  return prisma.timeSlot.create({ data: { date, startsAt, endsAt, capacity: 5 } });
}

export interface SeedDemoOrdersResult {
  created: number;
  updated: number;
}

// Requires the demo client (client@lavenet.ci) and the demo agency to
// already exist -- run after seedAgency/seedCatalog/the demo user, same
// ordering prisma/seed.ts already uses.
export async function seedDemoOrders(
  prisma: PrismaClient,
  clientUserId: string,
): Promise<SeedDemoOrdersResult> {
  const agency = await prisma.agency.findFirst();
  if (!agency) {
    throw new Error('Aucune agence trouvée -- lancez seedAgency avant seedDemoOrders.');
  }

  const services = await prisma.service.findMany();
  const serviceIdBySlug = new Map(services.map((s) => [s.slug, s.id]));
  const articleTypes = await prisma.articleType.findMany();
  const articleTypeIdBySlug = new Map(articleTypes.map((a) => [a.slug, a.id]));

  let created = 0;
  let updated = 0;

  for (const spec of ORDER_SPECS) {
    const basket = BASKETS[spec.basketIndex];
    const address = DELIVERY_ADDRESSES[spec.addressIndex];

    const subtotalXof = basket.reduce((sum, item) => sum + item.unitPriceXof * item.quantity, 0);
    const deliveryFeeXof = subtotalXof >= FREE_DELIVERY_THRESHOLD_XOF ? 0 : DELIVERY_FEE_XOF;
    const totalXof = subtotalXof + deliveryFeeXof;

    // Pickup ~07:00 (off the real rolling window's 8/10/14/16 grid --
    // same convention as cart.integration.spec.ts's throwaway fixtures),
    // delivery two days later at ~09:00. Always in the past, so this can
    // never collide with prisma/timeslot-data.ts's future rolling window.
    const pickupSlot =
      spec.pickupType === 'HOME'
        ? await findOrCreateSlot(
            prisma,
            dateOnly(daysAgoAt(spec.daysAgo, 7)),
            daysAgoAt(spec.daysAgo, 7),
            daysAgoAt(spec.daysAgo, 8),
          )
        : null;
    const deliveryDaysAgo = Math.max(spec.daysAgo - 2, 0);
    const deliverySlot = await findOrCreateSlot(
      prisma,
      dateOnly(daysAgoAt(deliveryDaysAgo, 9)),
      daysAgoAt(deliveryDaysAgo, 9),
      daysAgoAt(deliveryDaysAgo, 10),
    );

    const createdAt = daysAgoAt(spec.daysAgo, 7);

    const orderData = {
      userId: clientUserId,
      status: spec.status,
      reference: spec.reference,
      createdAt,
      pickupType: spec.pickupType,
      agencyId: spec.pickupType === 'AGENCY' ? agency.id : null,
      agencyDropoffDate: spec.pickupType === 'AGENCY' ? dateOnly(createdAt) : null,
      pickupSlotId: pickupSlot?.id ?? null,
      deliverySlotId: deliverySlot.id,
      deliveryCommune: address.commune,
      deliveryQuartier: address.quartier,
      deliveryDetails: address.details,
      subtotalXof,
      discountXof: 0,
      deliveryFeeXof,
      vatRateBps: 0,
      vatAmountXof: 0,
      totalXof,
    };

    const existing = await prisma.order.findUnique({ where: { reference: spec.reference } });

    const order = await prisma.order.upsert({
      where: { reference: spec.reference },
      create: orderData,
      update: orderData,
    });

    if (existing) {
      updated += 1;
      // Rerun-safe: drop and rebuild this order's own items/history rather
      // than trying to diff them -- cheap (a handful of rows) and avoids
      // duplicate items on every rerun.
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
    } else {
      created += 1;
    }

    for (const item of basket) {
      const serviceId = serviceIdBySlug.get(item.serviceSlug);
      if (!serviceId) {
        throw new Error(`Service inconnu "${item.serviceSlug}" -- lancez seedCatalog d'abord.`);
      }
      const articleTypeId = item.articleTypeSlug
        ? (articleTypeIdBySlug.get(item.articleTypeSlug) ?? null)
        : null;
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          serviceId,
          articleTypeId,
          quantity: item.quantity,
          unitPriceXof: item.unitPriceXof,
        },
      });
    }

    const history = historyFor(spec.status);
    for (const [index, entry] of history.entries()) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          actorId: clientUserId,
          reason: entry.reason,
          createdAt: new Date(createdAt.getTime() + index * 6 * 60 * 60 * 1000),
        },
      });
    }
  }

  return { created, updated };
}
