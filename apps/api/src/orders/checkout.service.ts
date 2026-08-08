import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  computeOrderTotals,
  formatXof,
  isPastDropoffDate,
  MIN_ORDER_XOF,
} from '@lavenet/shared-domain';
import type { Order, OrderItem } from '@lavenet/shared-schemas';
import { assertDeliveryNotBeforeMinimum } from './assert-delivery-slot';
import { formatIsoDate } from './format-iso-date';
import { type CheckoutOrderRecord, OrdersRepository } from './orders.repository';
import { resolvePriceForArticleType } from './resolve-price';

// F-CMD-05/07. The one place a DRAFT order becomes a real one: every
// precondition the checkout tunnel's own PATCH endpoints already checked
// (F-CMD-03/04) is re-checked here from scratch, against the *current*
// state of the world, never trusting that nothing changed since -- prices,
// service availability, the agency drop-off date, and the delivery-minimum
// rule can all have gone stale between "chosen in the cart" and "validated
// at checkout" (cahier §5.3: "Le total est toujours recalculé côté
// serveur au moment de la validation."). Slot capacity is the one thing
// that *can't* be checked in advance under concurrency -- that's
// OrdersRepository.commitCheckout's job (CLAUDE.md §4 rule 4).
@Injectable()
export class CheckoutService {
  constructor(private readonly repo: OrdersRepository) {}

  async checkout(userId: string): Promise<{ order: Order }> {
    const order = await this.repo.findDraftOrderForCheckout(userId);
    if (!order) {
      throw new NotFoundException('Panier introuvable.');
    }
    if (order.items.length === 0) {
      throw new BadRequestException('Le panier est vide.');
    }
    if (order.pickupType === null) {
      throw new BadRequestException("Choisissez d'abord un mode de retrait.");
    }
    if (!order.deliverySlotId || !order.deliverySlot) {
      throw new BadRequestException('Choisissez un créneau de livraison.');
    }
    // Narrowed into its own variable (rather than re-checking
    // order.pickupType === 'HOME' again below) so the HOME anchor branch
    // further down never needs a non-null assertion on order.pickupSlot.
    const pickupSlot = order.pickupType === 'HOME' ? order.pickupSlot : null;
    if (order.pickupType === 'HOME' && (!order.pickupSlotId || !pickupSlot)) {
      throw new BadRequestException('Choisissez un créneau de retrait.');
    }
    if (order.pickupType === 'AGENCY') {
      if (!order.agencyDropoffDate) {
        throw new BadRequestException("Choisissez d'abord un mode de retrait.");
      }
      if (isPastDropoffDate(order.agencyDropoffDate)) {
        throw new BadRequestException(
          'La date de dépôt en agence ne peut plus être dans le passé -- choisissez-en une nouvelle.',
        );
      }
    }
    if (!order.deliveryAddressId || !order.deliveryAddress) {
      throw new BadRequestException('Choisissez une adresse de livraison.');
    }

    // Fresh price resolution, never OrderItem.unitPriceXof (still null in
    // DRAFT) nor any cached figure from an earlier cart read (CLAUDE.md §4
    // rule 2) -- a line whose service was deactivated or whose PriceRule
    // expired since it was added rejects the whole checkout, it never
    // silently prices at zero or drops the line.
    const pricedItems = order.items.map((item) => {
      const serviceAvailable = item.service.isActive && !item.service.deletedAt;
      const priceRule = serviceAvailable
        ? resolvePriceForArticleType(item.service, item.articleTypeId)
        : undefined;
      return { item, unitPriceXof: priceRule?.amountXof ?? null };
    });
    if (pricedItems.some((priced) => priced.unitPriceXof === null)) {
      throw new BadRequestException(
        'Certains articles de votre panier ne sont plus disponibles. Retirez-les avant de valider votre commande.',
      );
    }

    const totals = computeOrderTotals(
      pricedItems.map((priced) => ({
        unitPriceXof: priced.unitPriceXof as number,
        quantity: priced.item.quantity,
      })),
    );

    // ADR-0006: below the minimum, HOME is refused server-side, not
    // surtaxed -- the message identifies the missing amount and offers
    // AGENCY explicitly.
    if (order.pickupType === 'HOME' && totals.subtotalXof < MIN_ORDER_XOF) {
      const missingXof = MIN_ORDER_XOF - totals.subtotalXof;
      throw new BadRequestException(
        `Montant minimum pour un enlèvement à domicile : ${formatXof(MIN_ORDER_XOF)}. Il manque ${formatXof(missingXof)} -- ou optez pour le dépôt en agence.`,
      );
    }

    const anchor =
      pickupSlot !== null
        ? { type: 'HOME' as const, slotEndsAt: pickupSlot.endsAt }
        : { type: 'AGENCY' as const, dropoffDate: order.agencyDropoffDate as Date };
    assertDeliveryNotBeforeMinimum(anchor, order.items, order.deliverySlot.startsAt);

    const result = await this.repo.commitCheckout({
      orderId: order.id,
      pickupSlotId: order.pickupType === 'HOME' ? (order.pickupSlotId as string) : null,
      deliverySlotId: order.deliverySlotId,
      itemPrices: pricedItems.map((priced) => ({
        itemId: priced.item.id,
        unitPriceXof: priced.unitPriceXof as number,
      })),
      totals,
      referenceYear: new Date().getFullYear(),
      address: {
        commune: order.deliveryAddress.commune,
        quartier: order.deliveryAddress.quartier,
        details: order.deliveryAddress.details,
        geoLat: order.deliveryAddress.geoLat,
        geoLng: order.deliveryAddress.geoLng,
      },
    });

    if (!result.ok) {
      const message =
        result.reason === 'PICKUP_SLOT_FULL'
          ? "Le créneau de retrait choisi vient d'être complété par une autre réservation. Choisissez-en un autre."
          : "Le créneau de livraison choisi vient d'être complété par une autre réservation. Choisissez-en un autre.";
      throw new ConflictException(message);
    }

    return { order: toOrder(result.order) };
  }
}

function toOrder(order: CheckoutOrderRecord): Order {
  const items: OrderItem[] = order.items.map((item) => ({
    id: item.id,
    serviceId: item.serviceId,
    serviceName: item.service.name,
    unit: item.service.unit as OrderItem['unit'],
    articleTypeId: item.articleTypeId,
    articleTypeName: item.articleType?.name ?? null,
    quantity: item.quantity,
    instructions: item.instructions,
    unitPriceXof: item.unitPriceXof as number,
    lineTotalXof: (item.unitPriceXof as number) * item.quantity,
  }));

  return {
    id: order.id,
    reference: order.reference as string,
    status: 'PENDING_PICKUP',
    items,
    subtotalXof: order.subtotalXof as number,
    discountXof: order.discountXof as number,
    deliveryFeeXof: order.deliveryFeeXof as number,
    vatRateBps: order.vatRateBps as number,
    vatAmountXof: order.vatAmountXof as number,
    totalXof: order.totalXof as number,
    pickupType: order.pickupType as 'HOME' | 'AGENCY',
    agencyId: order.agencyId,
    agencyDropoffDate: order.agencyDropoffDate ? formatIsoDate(order.agencyDropoffDate) : null,
    pickupSlotId: order.pickupSlotId,
    deliverySlotId: order.deliverySlotId as string,
    deliveryCommune: order.deliveryCommune as string,
    deliveryQuartier: order.deliveryQuartier as string,
    deliveryDetails: order.deliveryDetails as string,
    deliveryGeoLat: order.deliveryGeoLat,
    deliveryGeoLng: order.deliveryGeoLng,
    createdAt: order.createdAt.toISOString(),
  };
}
