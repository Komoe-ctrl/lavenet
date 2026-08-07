import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { resolveActivePriceRule } from '@lavenet/shared-domain';
import type {
  AddCartItemInput,
  Cart,
  CartItem,
  UpdateCartItemInput,
} from '@lavenet/shared-schemas';
import { OrdersRepository } from './orders.repository';

interface PriceRuleRecord {
  articleTypeId: string | null;
  amountXof: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

interface ServiceRecord {
  id: string;
  slug: string;
  name: string;
  unit: string;
  isActive: boolean;
  deletedAt: Date | null;
  priceRules: PriceRuleRecord[];
}

interface OrderItemRecord {
  id: string;
  serviceId: string;
  articleTypeId: string | null;
  articleType: { name: string } | null;
  quantity: number;
  instructions: string | null;
  service: ServiceRecord;
}

interface OrderWithItemsRecord {
  id: string;
  items: OrderItemRecord[];
}

@Injectable()
export class CartService {
  constructor(private readonly repo: OrdersRepository) {}

  async getCart(userId: string): Promise<{ cart: Cart }> {
    const order = (await this.repo.findDraftOrderWithItems(userId)) as OrderWithItemsRecord | null;
    return { cart: this.toCart(order) };
  }

  async addItem(userId: string, input: AddCartItemInput): Promise<{ cart: Cart }> {
    const service = (await this.repo.findServiceForPricing(
      input.serviceId,
    )) as ServiceRecord | null;
    if (!service || !service.isActive || service.deletedAt) {
      throw new BadRequestException('Service introuvable ou indisponible.');
    }
    const priceRule = resolvePriceForArticleType(service, input.articleTypeId ?? null);
    if (!priceRule) {
      throw new BadRequestException(
        "Aucun tarif actif pour cette combinaison service / type d'article.",
      );
    }

    const order = await this.repo.findOrCreateDraftOrder(userId);
    await this.repo.addItem({
      orderId: order.id,
      serviceId: input.serviceId,
      articleTypeId: input.articleTypeId,
      quantity: input.quantity,
      instructions: input.instructions,
    });

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<{ cart: Cart }> {
    await this.assertOwnedDraftItem(userId, itemId);
    await this.repo.updateItem(itemId, input);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<{ cart: Cart }> {
    await this.assertOwnedDraftItem(userId, itemId);
    await this.repo.removeItem(itemId);
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<{ cart: Cart }> {
    const order = await this.repo.findDraftOrderWithItems(userId);
    if (order) {
      await this.repo.clearItems(order.id);
    }
    return this.getCart(userId);
  }

  // Same NotFoundException whether the item doesn't exist, belongs to
  // another user, or belongs to an order that's no longer DRAFT (already
  // checked out or cancelled) -- an attacker probing ids can't tell any of
  // these apart (CLAUDE.md §5, IDOR).
  private async assertOwnedDraftItem(userId: string, itemId: string) {
    const item = await this.repo.findItemById(itemId);
    if (!item || item.order.userId !== userId || item.order.status !== 'DRAFT') {
      throw new NotFoundException('Article du panier introuvable.');
    }
    return item;
  }

  private toCart(order: OrderWithItemsRecord | null): Cart {
    if (!order) {
      return { id: null, items: [], subtotalXof: 0, hasUnavailablePricing: false };
    }

    let hasUnavailablePricing = false;
    let subtotalXof = 0;

    const items: CartItem[] = order.items.map((item) => {
      // A line is unavailable if its price rule is gone *or* its service
      // was deactivated/soft-deleted after being added -- both are the
      // same "can't be bought right now" state the checkout in a later
      // increment must reject explicitly, not silently price at zero.
      const serviceAvailable = item.service.isActive && !item.service.deletedAt;
      const priceRule = serviceAvailable
        ? resolvePriceForArticleType(item.service, item.articleTypeId)
        : undefined;
      const unitPriceXof = priceRule?.amountXof ?? null;
      const lineTotalXof = unitPriceXof !== null ? unitPriceXof * item.quantity : null;

      if (lineTotalXof === null) {
        hasUnavailablePricing = true;
      } else {
        subtotalXof += lineTotalXof;
      }

      return {
        id: item.id,
        serviceId: item.serviceId,
        serviceSlug: item.service.slug,
        serviceName: item.service.name,
        unit: item.service.unit as CartItem['unit'],
        articleTypeId: item.articleTypeId,
        articleTypeName: item.articleType?.name ?? null,
        quantity: item.quantity,
        instructions: item.instructions,
        unitPriceXof,
        lineTotalXof,
      };
    });

    return {
      id: order.id,
      items,
      subtotalXof: hasUnavailablePricing ? null : subtotalXof,
      hasUnavailablePricing,
    };
  }
}

function resolvePriceForArticleType(
  service: { priceRules: PriceRuleRecord[] },
  articleTypeId: string | null,
): PriceRuleRecord | undefined {
  const rules = service.priceRules.filter((rule) => rule.articleTypeId === articleTypeId);
  return resolveActivePriceRule(rules);
}
