import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  // One round trip: categories -> active services -> every price rule ever
  // recorded for those services (deliberately unfiltered by date here --
  // resolveActivePriceRule, not SQL, decides which row is active, so the
  // interval logic exists in exactly one place).
  findPublicCatalog() {
    return this.prisma.serviceCategory.findMany({
      orderBy: { position: 'asc' },
      include: {
        services: {
          where: { isActive: true, deletedAt: null },
          include: {
            priceRules: { include: { articleType: true } },
          },
        },
      },
    });
  }
}
