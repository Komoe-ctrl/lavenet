import type { OrderItem } from '@lavenet/shared-schemas';

// Shared by checkout.service.ts and orders.service.ts: both read a
// placed order's items through the same { service: true, articleType:
// true } include shape (orders.repository.ts's checkoutOrderInclude and
// orderDetailInclude), so both map it to the wire shape the same way.
// unitPriceXof is never null here -- both callers only ever see it after
// checkout has frozen it (CLAUDE.md §4 rule 2).
interface OrderItemRecord {
  id: string;
  serviceId: string;
  service: { name: string; unit: string };
  articleTypeId: string | null;
  articleType: { name: string } | null;
  quantity: number;
  instructions: string | null;
  unitPriceXof: number | null;
}

export function toOrderItem(item: OrderItemRecord): OrderItem {
  return {
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
  };
}
