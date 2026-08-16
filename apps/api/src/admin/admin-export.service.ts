import { Injectable } from '@nestjs/common';
import { AdminExportRepository, ExportDateRange } from './admin-export.repository';
import { buildCsv } from './csv';

const ORDER_HEADERS = [
  'Référence',
  'Date',
  'Statut',
  'Client',
  'Téléphone',
  'Mode de retrait',
  'Sous-total (XOF)',
  'Livraison (XOF)',
  'TVA (XOF)',
  'Total (XOF)',
];

const PAYMENT_HEADERS = ['Référence commande', 'Mode de paiement', 'Statut', 'Montant (XOF)', 'Date'];

// F-ADM-08. Amounts stay plain integer strings (`String(xof)`) -- never
// formatted with a thousands separator or a currency symbol, which would
// make the column useless for a spreadsheet formula. Money is displayed
// formatted only at the UI edge (MoneyPipe), never in an export meant to
// be computed on.
@Injectable()
export class AdminExportService {
  constructor(private readonly repo: AdminExportRepository) {}

  async ordersCsv(from: string, to: string): Promise<string> {
    const orders = await this.repo.findOrdersForExport(toUtcRange(from, to));
    const rows = orders.map((order) => [
      order.reference ?? '',
      order.createdAt.toISOString(),
      order.status,
      order.user.fullName ?? '',
      order.user.phone,
      order.pickupType ?? '',
      String(order.subtotalXof ?? 0),
      String(order.deliveryFeeXof ?? 0),
      String(order.vatAmountXof ?? 0),
      String(order.totalXof ?? 0),
    ]);
    return buildCsv(ORDER_HEADERS, rows);
  }

  async paymentsCsv(from: string, to: string): Promise<string> {
    const payments = await this.repo.findPaymentsForExport(toUtcRange(from, to));
    const rows = payments.map((payment) => [
      payment.order.reference ?? '',
      payment.provider,
      payment.status,
      String(payment.amountXof),
      payment.createdAt.toISOString(),
    ]);
    return buildCsv(PAYMENT_HEADERS, rows);
  }
}

// Same day-boundary convention as the admin order list's own date filters
// (orders.repository.ts's adminOrdersWhere): a plain YYYY-MM-DD is the
// whole UTC day, start to end.
function toUtcRange(from: string, to: string): ExportDateRange {
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  };
}
