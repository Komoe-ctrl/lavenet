import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Only ever future-facing: a slot whose window already started is never
  // worth offering, whether or not it has seats left.
  findUpcoming(now: Date = new Date()) {
    return this.prisma.timeSlot.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.timeSlot.findUnique({ where: { id } });
  }
}
