// Writes the OpenAPI document to disk without starting an HTTP listener or
// requiring a reachable database (Prisma connects lazily — see
// apps/api/src/prisma/prisma.service.ts). Consumed by `pnpm api:client`
// (ng-openapi-gen) to regenerate the Angular client — never hand-write an
// HTTP call against this API from the web app.
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../../apps/api/src/app/app.module';
import { API_GLOBAL_PREFIX, buildSwaggerConfig } from '../../apps/api/src/swagger.config';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  // Must match main.ts's app.setGlobalPrefix() — otherwise the generated
  // client is built against paths the real server doesn't serve.
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, buildSwaggerConfig()));

  const outPath = resolve(__dirname, '../../dist/openapi/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(document, null, 2));

   
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

main().catch((err) => {
   
  console.error(err);
  process.exit(1);
});
