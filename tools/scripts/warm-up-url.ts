import { API_GLOBAL_PREFIX } from '../../apps/api/src/swagger.config';
import { environment } from '../../apps/web/src/environments/environment.prod';

// Single source for the URL the build-time warm-up hits: derived from the
// same two values the real deployment already depends on -- apps/web's
// production API origin and apps/api's global route prefix -- instead of a
// third hand-typed copy that can silently drift from both. This is the
// third time a hand-reconstructed /api prefix has caused a bug in this
// project (the generated client, SessionStore, and this warm-up script);
// pure and exported separately from warm-up-api.ts so it's testable
// without triggering a real network call.
export function resolveCatalogWarmupUrl(): string {
  return `${environment.apiBaseUrl}/${API_GLOBAL_PREFIX}/catalog`;
}
