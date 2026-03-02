import { Worker, Job } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import sharp from 'sharp';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'thumbnail-generation';
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://orthanc:8042';

type ThumbnailJobData = {
  studyId: string;
  instanceId: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[Worker] Missing required environment variable: ${name}`);
  }
  return value;
}

const MINIO_ENDPOINT = getRequiredEnv('MINIO_ENDPOINT');
const MINIO_ROOT_USER = getRequiredEnv('MINIO_ROOT_USER');
const MINIO_ROOT_PASSWORD = getRequiredEnv('MINIO_ROOT_PASSWORD');
const MINIO_BUCKET = getRequiredEnv('MINIO_BUCKET');
const DATABASE_URL = getRequiredEnv('DATABASE_URL');

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateWorkerJwtFromPrivateKey(privateKey: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = 60 * 60 * 24 * 365;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    sub: 'worker',
    role: 'Admin',
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createSign('RSA-SHA256').update(data).end().sign(privateKey);
  return `${data}.${base64url(signature)}`;
}

function resolveWorkerJwt(): string {
  const configuredToken = process.env.WORKER_JWT?.trim();
  if (configuredToken) {
    return configuredToken;
  }

  const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKey) {
    throw new Error(
      '[Worker] WORKER_JWT is not set and JWT_PRIVATE_KEY is unavailable for auto-generation',
    );
  }

  console.log('[Worker] WORKER_JWT not set; generating token from JWT_PRIVATE_KEY');
  return generateWorkerJwtFromPrivateKey(privateKey);
}

const WORKER_JWT = resolveWorkerJwt();

const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: MINIO_ROOT_USER,
    secretAccessKey: MINIO_ROOT_PASSWORD,
  },
});

const dbPool = new Pool({
  connectionString: DATABASE_URL,
});

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
} {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

async function resolveRenderedUrl(studyId: string, instanceId: string): Promise<string> {
  const result = await dbPool.query<{
    orthancInstanceId: string | null;
    seriesInstanceUid: string | null;
  }>(
    `
      SELECT
        i.orthanc_instance_id AS "orthancInstanceId",
        s.series_instance_uid AS "seriesInstanceUid"
      FROM instances i
      INNER JOIN series s ON s.id = i.series_id
      INNER JOIN studies st ON st.id = s.study_id
      WHERE st.orthanc_study_id = $1
        AND i.sop_instance_uid = $2
      LIMIT 1
    `,
    [studyId, instanceId],
  );

  const orthancInstanceId = result.rows[0]?.orthancInstanceId;
  if (orthancInstanceId) {
    return `${ORTHANC_URL}/instances/${encodeURIComponent(orthancInstanceId)}/rendered`;
  }

  const seriesInstanceUid = result.rows[0]?.seriesInstanceUid;
  if (seriesInstanceUid) {
    return `${ORTHANC_URL}/dicom-web/studies/${encodeURIComponent(studyId)}/series/${encodeURIComponent(seriesInstanceUid)}/instances/${encodeURIComponent(instanceId)}/rendered`;
  }

  if (!result.rows[0]) {
    throw new Error(
      `Could not resolve rendered source for studyId=${studyId} and instanceId=${instanceId}`,
    );
  }

  throw new Error(
    `No orthanc_instance_id or series_instance_uid available for studyId=${studyId} and instanceId=${instanceId}`,
  );
}

function parseJobData(data: unknown): ThumbnailJobData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid job payload: expected object');
  }

  const candidate = data as Partial<ThumbnailJobData>;
  if (!candidate.studyId || !candidate.instanceId) {
    throw new Error('Invalid job payload: expected studyId and instanceId');
  }

  return {
    studyId: candidate.studyId,
    instanceId: candidate.instanceId,
  };
}

const redisConnection = parseRedisUrl(REDIS_URL);

console.log(`[Worker] Connecting to Redis at ${redisConnection.host}:${redisConnection.port}`);

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    console.log(`[Worker] Received job ${job.id} — ${job.name}`, {
      data: job.data,
    });

    const { studyId, instanceId } = parseJobData(job.data);
    const thumbnailKey = `thumbnails/${studyId}.jpg`;

    let renderedBuffer: Buffer;
    try {
      const renderedUrl = await resolveRenderedUrl(studyId, instanceId);
      const response = await fetch(renderedUrl, {
        headers: {
          Authorization: `Bearer ${WORKER_JWT}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Orthanc rendered fetch failed with status ${response.status}`);
      }

      const imageBytes = await response.arrayBuffer();
      renderedBuffer = Buffer.from(imageBytes);
    } catch (error) {
      console.error('[Worker] Failed fetching rendered frame from Orthanc', {
        studyId,
        instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const thumbnailBuffer = await sharp(renderedBuffer)
      .resize(256, 256, {
        fit: 'inside',
        background: { r: 0, g: 0, b: 0 },
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        }),
      );
    } catch (error) {
      console.error('[Worker] Failed uploading thumbnail to MinIO', {
        studyId,
        key: thumbnailKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    try {
      await dbPool.query(
        `
          UPDATE studies
          SET thumbnail_path = $1
          WHERE orthanc_study_id = $2
        `,
        [thumbnailKey, studyId],
      );
    } catch (error) {
      console.warn('[Worker] Failed to update study thumbnail_path in PostgreSQL', {
        studyId,
        key: thumbnailKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    console.log(`[Worker] Completed job ${job.id}`);
  },
  {
    connection: {
      host: redisConnection.host,
      port: redisConnection.port,
      username: redisConnection.username,
      password: redisConnection.password,
    },
  },
);

worker.on('completed', (job: Job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err: Error) => {
  console.error('[Worker] Worker error:', err.message);
});

console.log(`[Worker] Listening on queue "${QUEUE_NAME}"`);

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await dbPool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
