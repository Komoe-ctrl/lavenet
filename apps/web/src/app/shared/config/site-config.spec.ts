import { describe, expect, it } from 'vitest';
import { siteConfig, siteConfigSchema } from './site-config';

describe('siteConfig', () => {
  it('parses without throwing, proving the shipped values are valid', () => {
    expect(() => siteConfigSchema.parse(siteConfig)).not.toThrow();
  });

  it('rejects a missing required field instead of silently shipping a blank page', () => {
    const invalid = { ...siteConfig };
    Reflect.deleteProperty(invalid, 'brandName');
    expect(() => siteConfigSchema.parse(invalid)).toThrow();
  });

  it('rejects an empty communes list', () => {
    expect(() =>
      siteConfigSchema.parse({ ...siteConfig, coverage: { ...siteConfig.coverage, communes: [] } }),
    ).toThrow();
  });

  it('rejects a malformed contact email instead of silently shipping a broken mailto link', () => {
    expect(() =>
      siteConfigSchema.parse({
        ...siteConfig,
        contact: { ...siteConfig.contact, email: 'not-an-email' },
      }),
    ).toThrow();
  });

  it('rejects a phone number that is not E.164', () => {
    expect(() =>
      siteConfigSchema.parse({
        ...siteConfig,
        contact: { ...siteConfig.contact, phone: '0700000000' },
      }),
    ).toThrow();
  });

  // Product decision: every contact channel stays unset until the real
  // values are known -- never invent one.
  it('currently ships with no contact channel configured', () => {
    expect(siteConfig.contact.email).toBeNull();
    expect(siteConfig.contact.phone).toBeNull();
    expect(siteConfig.contact.whatsapp).toBeNull();
    expect(siteConfig.contact.address).toBeNull();
  });
});
