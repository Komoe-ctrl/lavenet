export const environment = {
  production: true,
  // No `/api` suffix — see environment.ts. If this URL ever changes, also
  // update the API_WARMUP_URL default in tools/scripts/warm-up-api.js
  // (vercel.json's buildCommand) — they must point at the same API.
  apiBaseUrl: 'https://lavenet-api.onrender.com',
};
