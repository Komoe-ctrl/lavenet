import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../apps/web/src/environments/environment.prod';
import { verifyPrerenderedMeta } from './check-prerendered-meta';

const HOME_URL = `${environment.siteUrl}/`;
const TARIFS_URL = `${environment.siteUrl}/tarifs`;
const IMAGE_URL = `${environment.siteUrl}/images/og-image.webp`;

function completeHead(ogUrl: string): string {
  return `<!doctype html><html><head>
    <meta property="og:title" content="x">
    <meta property="og:description" content="x">
    <meta property="og:image" content="${IMAGE_URL}">
    <meta property="og:url" content="${ogUrl}">
    <meta name="twitter:card" content="summary_large_image">
  </head><body></body></html>`;
}

describe('verifyPrerenderedMeta', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('reports no errors when both pages have complete, absolute OG tags', () => {
    dir = mkdtempSync(join(tmpdir(), 'og-check-'));
    mkdirSync(join(dir, 'tarifs'));
    writeFileSync(join(dir, 'index.html'), completeHead(HOME_URL));
    writeFileSync(join(dir, 'tarifs/index.html'), completeHead(TARIFS_URL));

    expect(verifyPrerenderedMeta(dir)).toEqual([]);
  });

  it('flags a missing tag', () => {
    dir = mkdtempSync(join(tmpdir(), 'og-check-'));
    mkdirSync(join(dir, 'tarifs'));
    writeFileSync(
      join(dir, 'index.html'),
      '<!doctype html><html><head><meta property="og:title" content="x"></head></html>',
    );
    writeFileSync(join(dir, 'tarifs/index.html'), completeHead(TARIFS_URL));

    const errors = verifyPrerenderedMeta(dir);
    expect(errors.some((e) => e.includes('index.html') && e.includes('og:image'))).toBe(true);
  });

  it('flags a non-absolute og:url', () => {
    dir = mkdtempSync(join(tmpdir(), 'og-check-'));
    mkdirSync(join(dir, 'tarifs'));
    writeFileSync(join(dir, 'index.html'), completeHead('/'));
    writeFileSync(join(dir, 'tarifs/index.html'), completeHead(TARIFS_URL));

    const errors = verifyPrerenderedMeta(dir);
    expect(errors.some((e) => e.includes('index.html') && e.includes('og:url'))).toBe(true);
  });

  it('reports the file as missing when the build has not run', () => {
    dir = mkdtempSync(join(tmpdir(), 'og-check-'));

    const errors = verifyPrerenderedMeta(dir);
    expect(errors.some((e) => e.includes('introuvable'))).toBe(true);
  });
});
