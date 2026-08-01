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
    coverage: {
      reportsDirectory: '../../coverage/apps/api',
      provider: 'v8' as const,
    },
  },
}));
