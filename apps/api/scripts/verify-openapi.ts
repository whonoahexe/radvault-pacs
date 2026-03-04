import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';

function ensureJwtKeys(): void {
  if (process.env.JWT_SIGNING_KEY && process.env.JWT_PUBLIC_KEY) {
    return;
  }

  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  process.env.JWT_SIGNING_KEY = pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  process.env.JWT_PUBLIC_KEY = pair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  process.env.JWT_EXPIRY = process.env.JWT_EXPIRY ?? '15m';
}

function buildSwaggerDocument(app: any) {
  const config = new DocumentBuilder()
    .setTitle('RadVault PACS API')
    .setDescription('Medical imaging PACS system API — DICOMweb, Worklist, Reporting, Auth')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

async function generateOpenApiArtifact(outputPath: string): Promise<void> {
  ensureJwtKeys();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      user: {
        findUnique: async () => null,
      },
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    })
    .compile();

  const app = moduleRef.createNestApplication(new ExpressAdapter(), {
    logger: false,
  });
  await app.init();

  try {
    const document = buildSwaggerDocument(app);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

    const hasOpenApiVersion = typeof document.openapi === 'string' && document.openapi.length > 0;
    const hasPaths = !!document.paths && Object.keys(document.paths).length > 0;

    if (!hasOpenApiVersion || !hasPaths) {
      throw new Error('Generated OpenAPI artifact is invalid: missing openapi version or paths');
    }
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), 'openapi', 'openapi.json');
  const generateOnly = process.argv.includes('--generate-only');

  await generateOpenApiArtifact(outputPath);

  if (generateOnly) {
    console.log(`OpenAPI artifact generated at ${outputPath}`);
    return;
  }

  console.log(`OpenAPI artifact verified at ${outputPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`OpenAPI verification failed: ${message}`);
  process.exitCode = 1;
});
