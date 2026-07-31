import { MoneyPipe } from './money.pipe';

// fr-FR groups thousands with a narrow no-break space (U+202F), not a
// regular one -- built from the escape explicitly rather than typing a
// literal character that could silently normalize to something else.
const THOUSANDS_SEPARATOR = ' ';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats a round amount with a thousands separator and the FCFA suffix', () => {
    expect(pipe.transform(12500)).toBe(`12${THOUSANDS_SEPARATOR}500 FCFA`);
  });

  it('formats a small amount without a separator', () => {
    expect(pipe.transform(500)).toBe('500 FCFA');
  });

  it('formats zero', () => {
    expect(pipe.transform(0)).toBe('0 FCFA');
  });
});
