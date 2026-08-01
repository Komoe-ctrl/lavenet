import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    // Each integration spec file boots its own Nest app (and Prisma
    // connection pool) against the same remote Neon dev branch. Running
    // spec files in parallel (vitest's default) pushes concurrent
    // connections past what the free-tier branch allows, and requests
    // queue until they blow past the default 5s test timeout -- not a
    // logic bug, just contention. One file at a time avoids it.
    fileParallelism: false,
    testTimeout: 15_000,
    // beforeAll/afterAll do the actual Nest app + Prisma pool bootstrap
    // against the same remote branch (see fileParallelism above) -- that
    // work needs the same headroom as testTimeout, not vitest's 10s
    // hookTimeout default, or a slow connection times out here instead.
    hookTimeout: 15_000,
    // Explicit, versioned default -- not the gitignored .env, which is
    // absent in CI. auth-registration.integration.spec.ts asserts on
    // demoOtpCode and needs DEMO_MODE=true to do it; the off-path is
    // exercised side-by-side by auth-demo-mode.integration.spec.ts, which
    // overrides this back to 'false' for itself via a dynamic import
    // (see that file's comment on why a static one wouldn't work).
    env: {
      DEMO_MODE: 'true',
    },
    coverage: {
      reportsDirectory: '../../coverage/apps/api',
      provider: 'v8' as const,
    },
  },
}));
