// Initialize OpenTelemetry before anything else
import './telemetry';

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { createWinstonLogger } from './common/logger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = createWinstonLogger();

  const app = await NestFactory.create(AppModule, { logger });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: '1',
  });

  // CORS
  app.enableCors();

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('RadVault PACS API')
    .setDescription('Medical imaging PACS system API — DICOMweb, Worklist, Reporting, Auth')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('docs', app as any, document);

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  logger.log(`RadVault API running on port ${port}`, 'Bootstrap');
}

bootstrap();
