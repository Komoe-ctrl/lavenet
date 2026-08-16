// F-ADM-08. Semicolon, not comma: French-locale Excel (this deployment's
// audience) opens a semicolon-delimited CSV correctly on double-click,
// where a comma-delimited one needs a manual import wizard to not get
// mis-split into one column. A UTF-8 BOM in front of the whole file is
// what makes Excel render accents correctly instead of guessing the wrong
// encoding -- without it, "café" renders as mojibake in a fresh double-
// click open, the exact failure mode this exists to avoid.
const DELIMITER = ';';
const BOM = '﻿';

// RFC 4180: a field needs quoting only if it contains the delimiter, a
// double quote, or a line break -- an embedded double quote is escaped by
// doubling it. Everything else passes through untouched, so an accented
// name like "Kouassi" never gets wrapped in quotes it doesn't need.
export function escapeCsvField(value: string): string {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(DELIMITER);
}

// CRLF line endings throughout (the RFC 4180 default) for the same
// Excel-compatibility reason as the delimiter choice.
export function buildCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [toCsvRow(headers), ...rows.map((row) => toCsvRow(row))];
  return BOM + lines.join('\r\n') + '\r\n';
}
