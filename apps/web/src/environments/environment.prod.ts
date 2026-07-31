// TODO(deploy): replace with the real Render API URL once apps/api is
// deployed (see docs/ADR/0003-cold-start-strategy.md and the pending
// deployment-config task).
export const environment = {
  production: true,
  // No `/api` suffix — see environment.ts.
  apiBaseUrl: 'https://REPLACE_WITH_RENDER_URL',
};
