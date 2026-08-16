import { buildCsv, escapeCsvField, toCsvRow } from './csv';

// F-ADM-08. A dedicated unit test for the escaping function itself,
// separate from the end-to-end export test -- an end-to-end test that
// happens to use fields with no special characters would pass even with
// a broken escapeCsvField, and mask exactly the bug this exists to catch.
describe('escapeCsvField', () => {
  it('passes a plain field through untouched', () => {
    expect(escapeCsvField('Kouassi')).toBe('Kouassi');
  });

  it('passes accented characters through untouched -- no quoting needed for them alone', () => {
    expect(escapeCsvField('Café Écrit à Abidjan')).toBe('Café Écrit à Abidjan');
  });

  it('quotes a field containing the delimiter', () => {
    expect(escapeCsvField('Cocody; Angré')).toBe('"Cocody; Angré"');
  });

  it('quotes and doubles an embedded double quote', () => {
    expect(escapeCsvField('Le service "Express"')).toBe('"Le service ""Express"""');
  });

  it('quotes a field containing a line break', () => {
    expect(escapeCsvField('Ligne 1\nLigne 2')).toBe('"Ligne 1\nLigne 2"');
    expect(escapeCsvField('Ligne 1\r\nLigne 2')).toBe('"Ligne 1\r\nLigne 2"');
  });

  it('leaves an empty field as an empty string, not two quotes', () => {
    expect(escapeCsvField('')).toBe('');
  });
});

describe('toCsvRow', () => {
  it('joins fields with a semicolon', () => {
    expect(toCsvRow(['LN-2026-000142', 'PENDING_PICKUP', '3400'])).toBe(
      'LN-2026-000142;PENDING_PICKUP;3400',
    );
  });

  it('escapes only the fields that need it, within one row', () => {
    expect(toCsvRow(['Kouassi', 'Cocody; Angré', '3400'])).toBe('Kouassi;"Cocody; Angré";3400');
  });
});

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildCsv(['A'], [['1']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF between every line, including after the last row', () => {
    const csv = buildCsv(['A', 'B'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('﻿A;B\r\n1;2\r\n3;4\r\n');
  });

  it('produces a header-only file for an empty dataset, never a blank file', () => {
    const csv = buildCsv(['Référence', 'Statut'], []);
    expect(csv).toBe('﻿Référence;Statut\r\n');
  });
});
