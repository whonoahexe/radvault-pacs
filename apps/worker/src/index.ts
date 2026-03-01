import { Worker, Job } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'thumbnail-generation';

function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisConnection = parseRedisUrl(REDIS_URL);

console.log(`[Worker] Connecting to Redis at ${redisConnection.host}:${redisConnection.port}`);

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    console.log(`[Worker] Received job ${job.id} — ${job.name}`, {
      data: job.data,
    });

    // Stub — no processing logic yet.
    // In Step 2 this will:
    // 1. Fetch rendered frame from Orthanc
    // 2. Resize to 256x256 with sharp
    // 3. Upload to MinIO
    // 4. Update study.thumbnail_path in PostgreSQL

    console.log(`[Worker] Completed job ${job.id}`);
  },
  {
    connection: {
      host: redisConnection.host,
      port: redisConnection.port,
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
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
