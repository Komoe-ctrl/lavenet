import { describe, expect, it } from 'vitest';
import { addCartItemSchema, cartSchema, updateCartItemSchema } from './cart.schemas';

describe('addCartItemSchema', () => {
  function validInput() {
    return { serviceId: 'svc_1', quantity: 2 };
  }

  it('accepts the minimal required fields', () => {
    expect(addCartItemSchema.safeParse(validInput()).success).toBe(true);
  });

  it('accepts an articleTypeId and instructions', () => {
    const result = addCartItemSchema.safeParse({
      ...validInput(),
      articleTypeId: 'art_1',
      instructions: 'Repasser sans amidon',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a zero or negative quantity', () => {
    expect(addCartItemSchema.safeParse({ ...validInput(), quantity: 0 }).success).toBe(false);
    expect(addCartItemSchema.safeParse({ ...validInput(), quantity: -1 }).success).toBe(false);
  });

  it('rejects a non-integer quantity', () => {
    expect(addCartItemSchema.safeParse({ ...validInput(), quantity: 1.5 }).success).toBe(false);
  });

  it('rejects a quantity above the maximum', () => {
    expect(addCartItemSchema.safeParse({ ...validInput(), quantity: 100 }).success).toBe(false);
  });

  it('rejects instructions over 250 characters, with a French message', () => {
    const result = addCartItemSchema.safeParse({
      ...validInput(),
      instructions: 'x'.repeat(251),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Les instructions sont limitées à 250 caractères.',
    );
  });

  it('accepts exactly 250 characters of instructions', () => {
    const result = addCartItemSchema.safeParse({
      ...validInput(),
      instructions: 'x'.repeat(250),
    });
    expect(result.success).toBe(true);
  });

  it('trims instructions', () => {
    const result = addCartItemSchema.safeParse({ ...validInput(), instructions: '  repasser  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instructions).toBe('repasser');
    }
  });

  it('rejects a missing serviceId', () => {
    expect(addCartItemSchema.safeParse({ quantity: 1 }).success).toBe(false);
  });
});

describe('updateCartItemSchema', () => {
  it('accepts an empty object -- PATCH semantics', () => {
    expect(updateCartItemSchema.safeParse({}).success).toBe(true);
  });

  it('accepts just a quantity', () => {
    expect(updateCartItemSchema.safeParse({ quantity: 3 }).success).toBe(true);
  });

  it('still validates quantity bounds when provided', () => {
    expect(updateCartItemSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });
});

describe('cartSchema', () => {
  it('accepts an empty cart with no order yet', () => {
    const result = cartSchema.safeParse({
      id: null,
      items: [],
      subtotalXof: 0,
      hasUnavailablePricing: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a line with unavailable pricing (null price/total)', () => {
    const result = cartSchema.safeParse({
      id: 'ord_1',
      items: [
        {
          id: 'item_1',
          serviceId: 'svc_1',
          serviceSlug: 'lavage-au-kilo',
          serviceName: 'Lavage au kilo',
          unit: 'KG',
          articleTypeId: null,
          articleTypeName: null,
          quantity: 2,
          instructions: null,
          unitPriceXof: null,
          lineTotalXof: null,
        },
      ],
      subtotalXof: null,
      hasUnavailablePricing: true,
    });
    expect(result.success).toBe(true);
  });
});
