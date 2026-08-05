import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateAddressData {
  userId: string;
  label: string;
  commune: string;
  quartier: string;
  details: string;
  geoLat?: number;
  geoLng?: number;
}

interface UpdateAddressData {
  label?: string;
  commune?: string;
  quartier?: string;
  details?: string;
  geoLat?: number;
  geoLng?: number;
  isDefault?: boolean;
}

@Injectable()
export class AddressesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForUser(userId: string) {
    return this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  findById(id: string) {
    return this.prisma.address.findUnique({ where: { id } });
  }

  create(data: CreateAddressData) {
    return this.prisma.address.create({ data: { ...data, isDefault: false } });
  }

  // Demotes every other default in the same transaction the new row is
  // created in, so a client can never end up with two defaults by creating
  // a second address with isDefault: true.
  createAsDefault(data: CreateAddressData) {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId: data.userId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.create({ data: { ...data, isDefault: true } });
    });
  }

  update(id: string, data: UpdateAddressData) {
    return this.prisma.address.update({ where: { id }, data });
  }

  // Same guarantee as createAsDefault, for promoting an existing address:
  // every other default for this user is demoted in the same transaction
  // the target is updated in -- enforced here, not left to the caller to
  // remember, so it can never be bypassed by calling update() directly.
  promoteToDefault(userId: string, id: string, data: Omit<UpdateAddressData, 'isDefault'>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, deletedAt: null, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      return tx.address.update({ where: { id }, data: { ...data, isDefault: true } });
    });
  }

  // Soft delete only -- see docs/ADR/0005-address-deletion-policy.md.
  softDelete(id: string) {
    return this.prisma.address.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
