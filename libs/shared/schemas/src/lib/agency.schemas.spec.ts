import { describe, expect, it } from 'vitest';
import { agenciesResponseSchema, agencySchema } from './agency.schemas';

describe('agencySchema', () => {
  it('accepts a well-formed agency', () => {
    const result = agencySchema.safeParse({
      id: 'agy_1',
      name: 'LaveNet Cocody',
      address: 'Cocody, Angré, Abidjan',
      openingHours: 'Lundi - Samedi, 8h - 18h',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing field', () => {
    expect(agencySchema.safeParse({ id: 'agy_1', name: 'LaveNet Cocody' }).success).toBe(false);
  });
});

describe('agenciesResponseSchema', () => {
  it('accepts an empty list', () => {
    expect(agenciesResponseSchema.safeParse({ agencies: [] }).success).toBe(true);
  });

  it('accepts a list of agencies', () => {
    const result = agenciesResponseSchema.safeParse({
      agencies: [
        {
          id: 'agy_1',
          name: 'LaveNet Cocody',
          address: 'Cocody, Angré, Abidjan',
          openingHours: 'Lundi - Samedi, 8h - 18h',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
