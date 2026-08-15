import { Injectable, NotFoundException } from '@nestjs/common';
import { toOrderItem } from '../orders/to-order-item';
import { InvoicesRepository } from './invoices.repository';
import { InvoicePdfItem, renderInvoicePdf } from './render-invoice-pdf';

// F-PAY-05.
@Injectable()
export class InvoicesService {
  constructor(private readonly repo: InvoicesRepository) {}

  // Same 404-either-way ownership pattern as OrdersService.detail
  // (CLAUDE.md §5, IDOR): a facture id that doesn't exist and one that
  // belongs to another client are indistinguishable to the caller.
  async downloadPdf(
    userId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.repo.findForDownload(invoiceId);
    if (!invoice || invoice.order.userId !== userId) {
      throw new NotFoundException('Facture introuvable.');
    }

    const items: InvoicePdfItem[] = invoice.order.items.map((item) => {
      const orderItem = toOrderItem(item);
      const name = orderItem.articleTypeName
        ? `${orderItem.serviceName} — ${orderItem.articleTypeName}`
        : orderItem.serviceName;
      return {
        name,
        quantity: orderItem.quantity,
        unitPriceXof: orderItem.unitPriceXof,
        lineTotalXof: orderItem.lineTotalXof,
      };
    });

    // Every amount/rate below comes from the Invoice row itself (issuer
    // identity, vatRateBps) or the already-frozen Order (subtotalXof etc.,
    // CLAUDE.md §4 rule 2) -- nothing here is recomputed, matching the
    // "figés, la facture les reprend tels quels" rule.
    const buffer = await renderInvoicePdf({
      invoiceNumber: invoice.number,
      issuedAt: invoice.issuedAt,
      issuerName: invoice.issuerName,
      issuerAddress: invoice.issuerAddress,
      issuerContact: invoice.issuerContact,
      vatRateBps: invoice.vatRateBps,
      orderReference: invoice.order.reference as string,
      items,
      subtotalXof: invoice.order.subtotalXof as number,
      discountXof: invoice.order.discountXof as number,
      deliveryFeeXof: invoice.order.deliveryFeeXof as number,
      vatAmountXof: invoice.order.vatAmountXof as number,
      totalXof: invoice.order.totalXof as number,
    });
    return { buffer, filename: `${invoice.number}.pdf` };
  }
}
