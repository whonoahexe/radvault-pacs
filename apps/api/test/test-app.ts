import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from '../src/app.module';

const USERS_BY_ROLE = {
  admin: {
    email: 'admin.test@radvault.local',
    password: 'Admin1234!',
    fullName: 'Admin Test',
    role: UserRole.Admin,
  },
  radiologist: {
    email: 'radiologist.test@radvault.local',
    password: 'Rad1234!',
    fullName: 'Dr. Test Radiologist',
    role: UserRole.Radiologist,
  },
  technologist: {
    email: 'technologist.test@radvault.local',
    password: 'Tech1234!',
    fullName: 'Technologist Test',
    role: UserRole.Technologist,
  },
  referringPhysician: {
    email: 'referring.test@radvault.local',
    password: 'Ref1234!',
    fullName: 'Dr. Test Referrer',
    role: UserRole.ReferringPhysician,
  },
} as const;

function ensureJwtKeys(): void {
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    return;
  }

  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  process.env.JWT_PRIVATE_KEY = pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  process.env.JWT_PUBLIC_KEY = pair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  process.env.JWT_EXPIRY = process.env.JWT_EXPIRY ?? '15m';
}

function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL (or DATABASE_URL) is required for integration tests');
  }

  return url;
}

function runMigrations(databaseUrl: string): void {
  const apiRoot = resolve(__dirname, '..');
  const commandEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  try {
    execSync('npx prisma migrate deploy --config ./prisma.config.ts', {
      cwd: apiRoot,
      env: commandEnv,
      stdio: 'pipe',
    });
  } catch {
    execSync('npx prisma db push --accept-data-loss --skip-generate --config ./prisma.config.ts', {
      cwd: apiRoot,
      env: commandEnv,
      stdio: 'pipe',
    });
  }
}

async function resetAndSeedMinimalData(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE audit_logs, refresh_tokens, report_versions, reports, worklist_items, instances, series, studies, patients, users RESTART IDENTITY CASCADE',
  );

  for (const user of Object.values(USERS_BY_ROLE)) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        isActive: true,
        passwordHash,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
        passwordHash,
      },
    });
  }
}

export async function isOrthancAvailable(orthancUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${orthancUrl}/system`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface IntegrationBootstrap {
  app: INestApplication;
  prisma: PrismaClient;
  usersByRole: typeof USERS_BY_ROLE;
}

export async function bootstrapIntegrationApp(): Promise<IntegrationBootstrap> {
  const databaseUrl = resolveTestDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  ensureJwtKeys();
  runMigrations(databaseUrl);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  await prisma.$connect();
  await resetAndSeedMinimalData(prisma);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    prisma,
    usersByRole: USERS_BY_ROLE,
  };
}
