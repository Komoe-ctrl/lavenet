import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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
  await app.listen(env.PORT);
  Logger.log(`🚀 Application is running on: http://localhost:${env.PORT}/${globalPrefix}`);
}

bootstrap();
