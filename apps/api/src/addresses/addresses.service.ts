import { Injectable, NotFoundException } from '@nestjs/common';
import type { Address as PrismaAddress } from '@prisma/client';
import type { Commune } from '@lavenet/shared-domain';
import type { Address, CreateAddressInput, UpdateAddressInput } from '@lavenet/shared-schemas';
import { AddressesRepository } from './addresses.repository';

@Injectable()
export class AddressesService {
  constructor(private readonly repo: AddressesRepository) {}

  async list(userId: string) {
    const addresses = await this.repo.findManyForUser(userId);
    return { addresses: addresses.map(toAddress) };
  }

  async create(userId: string, input: CreateAddressInput) {
    const { isDefault, ...rest } = input;
    const address = isDefault
      ? await this.repo.createAsDefault({ ...rest, userId })
      : await this.repo.create({ ...rest, userId });
    return { address: toAddress(address) };
  }

  async update(userId: string, addressId: string, input: UpdateAddressInput) {
    await this.assertOwnedAddress(userId, addressId);
    const { isDefault, ...rest } = input;
    const address =
      isDefault === true
        ? await this.repo.promoteToDefault(userId, addressId, rest)
        : await this.repo.update(addressId, input);
    return { address: toAddress(address) };
  }

  async remove(userId: string, addressId: string): Promise<void> {
    await this.assertOwnedAddress(userId, addressId);
    await this.repo.softDelete(addressId);
  }

  // Same NotFoundException whether the address doesn't exist, was already
  // deleted, or belongs to someone else -- an attacker probing ids by
  // incrementing them must not be able to tell "wrong id" from "someone
  // else's id" apart (CLAUDE.md §5, IDOR).
  private async assertOwnedAddress(userId: string, addressId: string) {
    const address = await this.repo.findById(addressId);
    if (!address || address.deletedAt || address.userId !== userId) {
      throw new NotFoundException('Adresse introuvable.');
    }
    return address;
  }
}

// commune is a free-text column (not a Postgres/Prisma enum) so adding a
// commune to COMMUNES never needs a migration -- zod is what actually
// enforces membership, at write time (create/update schemas). The cast
// reflects that guarantee, not an unchecked assumption.
function toAddress(address: PrismaAddress): Address {
  return {
    id: address.id,
    label: address.label,
    commune: address.commune as Commune,
    quartier: address.quartier,
    details: address.details,
    geoLat: address.geoLat,
    geoLng: address.geoLng,
    isDefault: address.isDefault,
  };
}
