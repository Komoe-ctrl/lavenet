import { resolveActivePriceRule, type PriceRuleLike } from './price-rule';

function rule(
  amountXof: number,
  effectiveFrom: string,
  effectiveTo: string | null = null,
): PriceRuleLike {
  return {
    amountXof,
    effectiveFrom: new Date(effectiveFrom),
    effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
  };
}

const AT = new Date('2026-07-31T12:00:00Z');

describe('resolveActivePriceRule', () => {
  it('returns undefined for an empty rule set', () => {
    expect(resolveActivePriceRule([], AT)).toBeUndefined();
  });

  it('returns the single open-ended rule that started in the past', () => {
    const open = rule(1200, '2026-01-01T00:00:00Z');
    expect(resolveActivePriceRule([open], AT)).toBe(open);
  });

  it('excludes a rule closed before `at` (expired)', () => {
    const expired = rule(1000, '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z');
    expect(resolveActivePriceRule([expired], AT)).toBeUndefined();
  });

  it('excludes a rule that starts after `at` (future)', () => {
    const future = rule(1500, '2026-09-01T00:00:00Z');
    expect(resolveActivePriceRule([future], AT)).toBeUndefined();
  });

  it('picks the current rule among a real history: past (expired) + current (open)', () => {
    const past = rule(1000, '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z');
    const current = rule(1200, '2026-06-01T00:00:00Z');
    expect(resolveActivePriceRule([past, current], AT)).toBe(current);
  });

  it('picks the most recently started rule among several historical rows', () => {
    const r1 = rule(900, '2025-01-01T00:00:00Z', '2025-06-01T00:00:00Z');
    const r2 = rule(1000, '2025-06-01T00:00:00Z', '2026-01-01T00:00:00Z');
    const r3 = rule(1200, '2026-01-01T00:00:00Z');
    expect(resolveActivePriceRule([r3, r1, r2], AT)).toBe(r3);
  });

  it('is inclusive on effectiveFrom: a rule starting exactly at `at` is active', () => {
    const startsNow = rule(1300, AT.toISOString());
    expect(resolveActivePriceRule([startsNow], AT)).toBe(startsNow);
  });

  it('is exclusive on effectiveTo: a rule closing exactly at `at` is no longer active', () => {
    const closesNow = rule(1000, '2026-01-01T00:00:00Z', AT.toISOString());
    expect(resolveActivePriceRule([closesNow], AT)).toBeUndefined();
  });

  it('returns undefined when the only rules are fully expired with no successor', () => {
    const expired = rule(1000, '2025-01-01T00:00:00Z', '2025-06-01T00:00:00Z');
    expect(resolveActivePriceRule([expired], AT)).toBeUndefined();
  });

  it('defensively picks the latest-started rule if two active rules overlap', () => {
    const older = rule(1000, '2026-01-01T00:00:00Z');
    const newer = rule(1100, '2026-05-01T00:00:00Z');
    expect(resolveActivePriceRule([older, newer], AT)).toBe(newer);
  });
});
