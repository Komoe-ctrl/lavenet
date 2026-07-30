import { DocumentBuilder } from '@nestjs/swagger';

// Shared between main.ts and tools/scripts/generate-openapi-spec.ts: the
// generated OpenAPI document (and thus the generated Angular client) must
// reflect the real global prefix, or the client calls the wrong path.
export const API_GLOBAL_PREFIX = 'api';

// Shared between main.ts (serves it at /docs) and
// tools/scripts/generate-openapi-spec.ts (writes it to a file consumed by
// `pnpm api:client`) — one config, not two copies that can drift.
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('LaveNet API')
    .setDescription('API pour LaveNet — blanchisserie en ligne (Abidjan)')
    .setVersion('0.1')
    .addCookieAuth('refresh_token')
    .build();
}
