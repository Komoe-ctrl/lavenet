import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgenciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agency.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.agency.findUnique({ where: { id } });
  }
}
