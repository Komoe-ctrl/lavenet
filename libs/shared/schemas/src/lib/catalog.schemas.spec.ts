import { catalogResponseSchema } from './catalog.schemas';

function validResponse() {
  return {
    categories: [
      {
        id: 'cat_1',
        slug: 'lavage',
        name: 'Lavage',
        position: 0,
        services: [
          {
            id: 'svc_1',
            slug: 'lavage-au-kilo',
            name: 'Lavage au kilo',
            unit: 'KG',
            processingHours: 24,
            prices: [{ articleTypeId: null, articleTypeName: null, amountXof: 1200 }],
          },
        ],
      },
    ],
  };
}

describe('catalogResponseSchema', () => {
  it('accepts a well-formed catalog with a KG service (no article type)', () => {
    expect(catalogResponseSchema.safeParse(validResponse()).success).toBe(true);
  });

  it('accepts a price with an article type', () => {
    const payload = validResponse();
    payload.categories[0].services[0].prices = [
      { articleTypeId: 'art_1', articleTypeName: 'Chemise', amountXof: 500 },
    ];
    expect(catalogResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown unit', () => {
    const payload = validResponse();
    // @ts-expect-error deliberately invalid for the test
    payload.categories[0].services[0].unit = 'LITRE';
    expect(catalogResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a negative price', () => {
    const payload = validResponse();
    payload.categories[0].services[0].prices[0].amountXof = -100;
    expect(catalogResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects zero processing hours', () => {
    const payload = validResponse();
    payload.categories[0].services[0].processingHours = 0;
    expect(catalogResponseSchema.safeParse(payload).success).toBe(false);
  });
});
