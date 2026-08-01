import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { environment } from '../../apps/web/src/environments/environment.prod';

// This is the check the lot 2 "no title/image in WhatsApp preview" report
// asked for: the Meta/Title services being called proves Angular's model
// is correct, but not that the tags actually reach the static HTML a
// crawler fetches -- crawlers never run JS, so only the file on disk after
// `ng build`'s prerendering step matters. Reads dist/, not TestBed.
const DIST_BROWSER = join(__dirname, '../../dist/apps/web/browser');

interface PageCheck {
  file: string;
  expectedUrl: string;
}

const PAGES: PageCheck[] = [
  { file: 'index.html', expectedUrl: `${environment.siteUrl}/` },
  { file: 'tarifs/index.html', expectedUrl: `${environment.siteUrl}/tarifs` },
];

const REQUIRED_TAGS = [
  'property="og:title"',
  'property="og:description"',
  'property="og:image"',
  'property="og:url"',
  'name="twitter:card"',
];

function verifyPage(distBrowserDir: string, { file, expectedUrl }: PageCheck): string[] {
  const path = join(distBrowserDir, file);
  let html: string;
  try {
    html = readFileSync(path, 'utf-8');
  } catch {
    return [
      `${file}: introuvable à ${path} -- lancez "pnpm exec nx build web --configuration=production" avant ce script.`,
    ];
  }

  const errors: string[] = [];
  for (const tag of REQUIRED_TAGS) {
    if (!html.includes(tag)) errors.push(`${file}: balise manquante (${tag})`);
  }
  if (!html.includes(`property="og:url" content="${expectedUrl}"`)) {
    errors.push(`${file}: og:url absent, ou pas l'URL absolue attendue (${expectedUrl})`);
  }
  if (!html.includes(`property="og:image" content="${environment.siteUrl}/`)) {
    errors.push(
      `${file}: og:image absent, ou pas une URL absolue (préfixe attendu ${environment.siteUrl}/)`,
    );
  }
  return errors;
}

// Pure and side-effect-free (no process.exit, no console output) so the
// spec can import and call it directly, like warm-up-url.ts. The CLI
// runner lives in verify-prerendered-meta.js instead.
export function verifyPrerenderedMeta(distBrowserDir: string = DIST_BROWSER): string[] {
  return PAGES.flatMap((page) => verifyPage(distBrowserDir, page));
}
