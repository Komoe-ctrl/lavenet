import { describe, expect, it } from 'vitest';
import { addressSchema, createAddressSchema, updateAddressSchema } from './address.schemas';

function validAddress() {
  return {
    id: 'addr_1',
    label: 'Maison',
    commune: 'Cocody',
    quartier: 'Angré',
    details: 'Immeuble bleu, 2e portail après la pharmacie',
    geoLat: null,
    geoLng: null,
    isDefault: true,
  };
}

describe('addressSchema', () => {
  it('accepts a well-formed address', () => {
    expect(addressSchema.safeParse(validAddress()).success).toBe(true);
  });

  it('accepts real geo coordinates', () => {
    const payload = { ...validAddress(), geoLat: 5.359, geoLng: -3.985 };
    expect(addressSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects a commune outside the centralized list', () => {
    const payload = { ...validAddress(), commune: 'Neverland' };
    const result = addressSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Commune invalide.');
  });
});

describe('createAddressSchema', () => {
  function validInput() {
    return {
      label: 'Maison',
      commune: 'Cocody',
      quartier: 'Angré',
      details: 'Immeuble bleu, 2e portail après la pharmacie',
    };
  }

  it('accepts the minimal required fields, isDefault and geo optional', () => {
    expect(createAddressSchema.safeParse(validInput()).success).toBe(true);
  });

  it('rejects a details field that is too short -- it is the field that actually finds the door', () => {
    const result = createAddressSchema.safeParse({ ...validInput(), details: 'no' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Merci d'indiquer un repère pour vous trouver (au moins 3 caractères).",
    );
  });

  it('rejects a commune not in the centralized list, with a French message', () => {
    const result = createAddressSchema.safeParse({ ...validInput(), commune: 'Paris' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Commune invalide.');
  });

  it('rejects a one-character label', () => {
    const result = createAddressSchema.safeParse({ ...validInput(), label: 'M' });
    expect(result.success).toBe(false);
  });

  it('trims label, quartier and details', () => {
    const result = createAddressSchema.safeParse({
      ...validInput(),
      label: '  Maison  ',
      quartier: '  Angré  ',
      details: '  Immeuble bleu  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).toBe('Maison');
      expect(result.data.quartier).toBe('Angré');
      expect(result.data.details).toBe('Immeuble bleu');
    }
  });
});

describe('updateAddressSchema', () => {
  it('accepts an empty object -- every field optional, PATCH semantics', () => {
    expect(updateAddressSchema.safeParse({}).success).toBe(true);
  });

  it('accepts just isDefault, to promote an existing address without resending everything else', () => {
    expect(updateAddressSchema.safeParse({ isDefault: true }).success).toBe(true);
  });

  it('still validates a field when it is provided', () => {
    const result = updateAddressSchema.safeParse({ commune: 'Nowhere' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Commune invalide.');
  });
});
