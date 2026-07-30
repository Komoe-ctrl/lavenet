import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// `env` must be imported first: it validates process.env and exits the
// process immediately if a required variable is missing or invalid,
// before any other module (Prisma, Nest) has a chance to boot on top
// of a broken configuration.
import { env } from './config/env';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // The OpenAPI document is the source of truth for the Angular client
  // (see `pnpm api:client`) — never hand-write a duplicate HTTP call.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LaveNet API')
    .setDescription('API pour LaveNet — blanchisserie en ligne (Abidjan)')
    .setVersion('0.1')
    .addCookieAuth('refresh_token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(env.PORT);
  Logger.log(`🚀 Application is running on: http://localhost:${env.PORT}/${globalPrefix}`);
  Logger.log(`📖 OpenAPI docs available on: http://localhost:${env.PORT}/docs`);
}

bootstrap();
