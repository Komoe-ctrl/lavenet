import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
// `env` must be imported first: it validates process.env and exits the
// process immediately if a required variable is missing or invalid,
// before any other module (Prisma, Nest) has a chance to boot on top
// of a broken configuration.
import { env } from './config/env';
import { AppModule } from './app/app.module';
import { API_GLOBAL_PREFIX, buildSwaggerConfig } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // The OpenAPI document is the source of truth for the Angular client
  // (see `pnpm api:client`) — never hand-write a duplicate HTTP call.
  const swaggerDocument = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(swaggerDocument));

  await app.listen(env.PORT);
  Logger.log(`🚀 Application is running on: http://localhost:${env.PORT}/${API_GLOBAL_PREFIX}`);
  Logger.log(`📖 OpenAPI docs available on: http://localhost:${env.PORT}/docs`);
}

bootstrap();
