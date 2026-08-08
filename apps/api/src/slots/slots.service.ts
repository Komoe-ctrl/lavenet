import { Injectable } from '@nestjs/common';
import type { SlotsResponse } from '@lavenet/shared-schemas';
import { SlotsRepository } from './slots.repository';

@Injectable()
export class SlotsService {
  constructor(private readonly repository: SlotsRepository) {}

  async listSlots(): Promise<SlotsResponse> {
    const slots = await this.repository.findUpcoming();
    return {
      slots: slots.map((slot) => ({
        id: slot.id,
        date: slot.date.toISOString().slice(0, 10),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        capacity: slot.capacity,
        seatsAvailable: slot.capacity - slot.bookedCount,
      })),
    };
  }
}
