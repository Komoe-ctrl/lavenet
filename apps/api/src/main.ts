import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';
// `env` must be imported first: it validates process.env and exits the
// process immediately if a required variable is missing or invalid,
// before any other module (Prisma, Nest) has a chance to boot on top
// of a broken configuration.
import { env } from './config/env';
import { AppModule } from './app/app.module';
import { API_GLOBAL_PREFIX, buildSwaggerConfig } from './swagger.config';

async function bootstrap() {
  // rawBody: true -- F-PAY-03's webhook signature check needs the exact
  // bytes the provider signed, not a re-serialized copy of the parsed JSON
  // (key order/whitespace can differ and would break the HMAC comparison).
  // Every route still gets its normal parsed req.body; only the webhook
  // handler reads req.rawBody.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.use(cookieParser());
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
