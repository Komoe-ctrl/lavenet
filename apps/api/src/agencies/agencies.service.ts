import { Injectable } from '@nestjs/common';
import type { AgenciesResponse } from '@lavenet/shared-schemas';
import { AgenciesRepository } from './agencies.repository';

@Injectable()
export class AgenciesService {
  constructor(private readonly repository: AgenciesRepository) {}

  async listAgencies(): Promise<AgenciesResponse> {
    const agencies = await this.repository.findAll();
    return {
      agencies: agencies.map((agency) => ({
        id: agency.id,
        name: agency.name,
        address: agency.address,
        openingHours: agency.openingHours,
      })),
    };
  }
}
