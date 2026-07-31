// Default (development) values — imported directly by app.config.ts.
// Swapped for environment.prod.ts at build time via the `production`
// configuration's fileReplacements (apps/web/project.json).
export const environment = {
  production: false,
  // No `/api` suffix: the generated client's function PATH constants
  // already include the global prefix (see apps/api/src/swagger.config.ts)
  // — this is the API's bare origin, used as ApiConfiguration.rootUrl.
  apiBaseUrl: 'http://localhost:3000',
};
