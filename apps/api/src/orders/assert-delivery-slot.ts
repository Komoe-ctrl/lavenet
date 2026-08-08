import { BadRequestException } from '@nestjs/common';
import { resolveMinDeliverySlot } from '@lavenet/shared-domain';

interface ProcessingTimeItem {
  service: { processingHours: number };
}

// F-CMD-04/05: shared by CartService.setSlots (a preference, re-checked at
// save time) and CheckoutService.checkout (the same rule, re-checked once
// more at validation time in case items changed after the slots were
// chosen) -- one rule, one place, per CLAUDE.md §3.
export function assertDeliveryNotBeforeMinimum(
  anchor: Parameters<typeof resolveMinDeliverySlot>[0],
  items: readonly ProcessingTimeItem[],
  deliverySlotStartsAt: Date,
): void {
  const slowestProcessingHours = Math.max(...items.map((item) => item.service.processingHours));
  const minDeliverySlot = resolveMinDeliverySlot(anchor, slowestProcessingHours);
  if (deliverySlotStartsAt < minDeliverySlot) {
    throw new BadRequestException(
      'Le créneau de livraison choisi est trop proche du retrait pour le temps de traitement requis.',
    );
  }
}
