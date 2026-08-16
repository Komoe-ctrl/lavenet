import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ExportDateRange {
  from: Date;
  to: Date;
}

// F-ADM-08. Plain Prisma findMany, not raw SQL -- exporting rows is not
// an aggregate, so CLAUDE.md §2's raw-SQL exception (dashboard aggregates
// / slot reservation) doesn't cover it. DRAFT excluded the same way the
// admin order list and the dashboard both already exclude it (a cart,
// not a placed order); CANCELLED stays in -- an export is a record of
// what happened, not a revenue figure.
@Injectable()
export class AdminExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrdersForExport(range: ExportDateRange) {
    return this.prisma.order.findMany({
      where: { status: { not: 'DRAFT' }, createdAt: { gte: range.from, lte: range.to } },
      select: {
        reference: true,
        createdAt: true,
        status: true,
        pickupType: true,
        subtotalXof: true,
        deliveryFeeXof: true,
        vatAmountXof: true,
        totalXof: true,
        user: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPaymentsForExport(range: ExportDateRange) {
    return this.prisma.payment.findMany({
      where: { createdAt: { gte: range.from, lte: range.to }, order: { status: { not: 'DRAFT' } } },
      select: {
        provider: true,
        status: true,
        amountXof: true,
        createdAt: true,
        order: { select: { reference: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
