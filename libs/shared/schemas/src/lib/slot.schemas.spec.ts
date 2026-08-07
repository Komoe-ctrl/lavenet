import { describe, expect, it } from 'vitest';
import { setSlotsSchema, slotsResponseSchema, timeSlotSchema } from './slot.schemas';

describe('timeSlotSchema', () => {
  it('accepts a well-formed slot', () => {
    const result = timeSlotSchema.safeParse({
      id: 'slot_1',
      date: '2026-08-10',
      startsAt: '2026-08-10T08:00:00.000Z',
      endsAt: '2026-08-10T10:00:00.000Z',
      capacity: 5,
      seatsAvailable: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a datetime with no timezone', () => {
    const result = timeSlotSchema.safeParse({
      id: 'slot_1',
      date: '2026-08-10',
      startsAt: '2026-08-10T08:00:00',
      endsAt: '2026-08-10T10:00:00.000Z',
      capacity: 5,
      seatsAvailable: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe('slotsResponseSchema', () => {
  it('accepts an empty list', () => {
    expect(slotsResponseSchema.safeParse({ slots: [] }).success).toBe(true);
  });
});

describe('setSlotsSchema', () => {
  it('accepts deliverySlotId alone (AGENCY pickup)', () => {
    expect(setSlotsSchema.safeParse({ deliverySlotId: 'slot_1' }).success).toBe(true);
  });

  it('accepts both pickupSlotId and deliverySlotId (HOME pickup)', () => {
    const result = setSlotsSchema.safeParse({
      pickupSlotId: 'slot_1',
      deliverySlotId: 'slot_2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing deliverySlotId, with a French message', () => {
    const result = setSlotsSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Créneau de livraison requis.');
  });
});
