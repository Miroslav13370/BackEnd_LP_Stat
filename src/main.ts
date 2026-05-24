import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import morgan from 'morgan';

import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(morgan('dev'));

  app.use(cookieParser());

  app.setGlobalPrefix('api');
  await app.listen(5001);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
