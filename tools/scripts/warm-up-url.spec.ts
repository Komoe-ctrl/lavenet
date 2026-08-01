import { describe, expect, it } from 'vitest';
import { API_GLOBAL_PREFIX } from '../../apps/api/src/swagger.config';
import { environment } from '../../apps/web/src/environments/environment.prod';
import { resolveCatalogWarmupUrl } from './warm-up-url';

describe('resolveCatalogWarmupUrl', () => {
  it('targets the production API origin with the real global prefix', () => {
    expect(resolveCatalogWarmupUrl()).toBe('https://lavenet-api.onrender.com/api/catalog');
  });

  // Guards against exactly the failure this function exists to prevent:
  // silently drifting from the values apps/web and apps/api actually use,
  // rather than pinning the test to a literal that could drift right
  // alongside a hand-typed URL would have.
  it('is built from environment.prod.ts and swagger.config.ts, not a hardcoded copy', () => {
    expect(resolveCatalogWarmupUrl()).toBe(
      `${environment.apiBaseUrl}/${API_GLOBAL_PREFIX}/catalog`,
    );
  });
});
