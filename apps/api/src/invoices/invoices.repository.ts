import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const invoiceForDownloadInclude = {
  order: {
    include: {
      items: { include: { service: true, articleType: true }, orderBy: { createdAt: 'asc' as const } },
    },
  },
} as const;

export type InvoiceForDownload = Awaited<
  ReturnType<InvoicesRepository['findForDownload']>
>;

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForDownload(invoiceId: string) {
    return this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: invoiceForDownloadInclude,
    });
  }
}
