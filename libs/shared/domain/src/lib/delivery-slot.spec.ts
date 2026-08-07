import { resolveMinDeliverySlot } from './delivery-slot';

describe('resolveMinDeliverySlot', () => {
  it('HOME: adds the processing delay to the pickup slot end time', () => {
    const result = resolveMinDeliverySlot(
      { type: 'HOME', slotEndsAt: new Date('2026-08-10T12:00:00Z') },
      24,
    );
    expect(result).toEqual(new Date('2026-08-11T12:00:00Z'));
  });

  it('HOME: uses the slowest service in the cart, not an arbitrary one', () => {
    const result = resolveMinDeliverySlot(
      { type: 'HOME', slotEndsAt: new Date('2026-08-10T12:00:00Z') },
      96,
    );
    expect(result).toEqual(new Date('2026-08-14T12:00:00Z'));
  });

  it('AGENCY: anchors on the end of the drop-off calendar day, not "now"', () => {
    const result = resolveMinDeliverySlot(
      { type: 'AGENCY', dropoffDate: new Date('2026-08-10T00:00:00Z') },
      24,
    );
    expect(result).toEqual(new Date('2026-08-11T23:59:59.999Z'));
  });

  it('AGENCY: ignores any time-of-day carried by the dropoffDate itself', () => {
    const withNoise = resolveMinDeliverySlot(
      { type: 'AGENCY', dropoffDate: new Date('2026-08-10T09:30:00Z') },
      0,
    );
    const clean = resolveMinDeliverySlot(
      { type: 'AGENCY', dropoffDate: new Date('2026-08-10T00:00:00Z') },
      0,
    );
    expect(withNoise).toEqual(clean);
  });

  it('a zero-hour delay still respects the anchor itself', () => {
    const result = resolveMinDeliverySlot(
      { type: 'HOME', slotEndsAt: new Date('2026-08-10T12:00:00Z') },
      0,
    );
    expect(result).toEqual(new Date('2026-08-10T12:00:00Z'));
  });
});
