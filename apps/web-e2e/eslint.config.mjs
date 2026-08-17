import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
  {
    // utils.ts's waitForHydration() deliberately waits for network-idle
    // plus a fixed pause as a workaround for an SSR/hydration race with no
    // other DOM-observable signal to assert on instead (see the comment
    // there) -- exactly what these two rules normally guard against, but
    // not applicable here. Off at the config level, not via an inline
    // disable comment: the lint-staged pre-commit hook resolves this
    // nested config differently than `nx run web-e2e:lint` (CI) does on
    // this OS, and an inline comment gets flagged unused -- then silently
    // deleted by --fix -- under that different resolution.
    files: ['src/utils.ts'],
    rules: {
      'playwright/no-networkidle': 'off',
      'playwright/no-wait-for-timeout': 'off',
    },
  },
];
