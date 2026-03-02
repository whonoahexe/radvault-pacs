import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, WorklistStatus } from '@prisma/client';
import { bootstrapIntegrationApp, isOrthancAvailable } from './test-app';

describe('@group integration DICOM + Worklist API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let usersByRole: Awaited<ReturnType<typeof bootstrapIntegrationApp>>['usersByRole'];
  let skipOrthancSuite = false;
  let technologistToken = '';
  let radiologistToken = '';
  let uploadedStudyUid = '';
  let uploadedWorklistId = '';

  beforeAll(async () => {
    const bootstrap = await bootstrapIntegrationApp();
    app = bootstrap.app;
    prisma = bootstrap.prisma;
    usersByRole = bootstrap.usersByRole;

    const orthancUrl = process.env.ORTHANC_URL ?? 'http://localhost:8042';
    skipOrthancSuite = !(await isOrthancAvailable(orthancUrl));

    if (!skipOrthancSuite) {
      const techLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: usersByRole.technologist.email,
          password: usersByRole.technologist.password,
        })
        .expect(200);

      technologistToken = techLogin.body.accessToken;

      const radLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: usersByRole.radiologist.email,
          password: usersByRole.radiologist.password,
        })
        .expect(200);

      radiologistToken = radLogin.body.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const itIfOrthanc = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (skipOrthancSuite) {
        console.warn('Skipping Orthanc-dependent integration test: Orthanc unavailable');
        return;
      }

      await fn();
    });
  };

  itIfOrthanc(
    'POST /api/dicom-web/studies uploads DICOM, persists study, creates Scheduled worklist',
    async () => {
      const dicomPath = resolve(__dirname, '../prisma/seed-data/CT_small.dcm');
      const dicomBuffer = await readFile(dicomPath);
      const boundary = `boundary-${Date.now()}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`),
        dicomBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const upload = await request(app.getHttpServer())
        .post('/api/dicom-web/studies')
        .set('Authorization', `Bearer ${technologistToken}`)
        .set('Content-Type', `multipart/related; type="application/dicom"; boundary=${boundary}`)
        .send(body)
        .expect(200);

      const payload = JSON.parse(upload.text) as Record<string, { Value?: unknown[] }>;
      const stowUri = payload['00081190']?.Value?.[0] as string;
      uploadedStudyUid = stowUri.split('studies/')[1]?.split('/')[0] ?? '';
      expect(uploadedStudyUid).toBeTruthy();

      const study = await prisma.study.findUnique({
        where: { studyInstanceUid: uploadedStudyUid },
        include: { worklistItem: true },
      });

      expect(study).toBeTruthy();
      expect(study?.worklistItem).toBeTruthy();
      expect(study?.worklistItem?.status).toBe(WorklistStatus.Scheduled);
      uploadedWorklistId = study!.worklistItem!.id;
    },
  );

  itIfOrthanc('GET /api/dicom-web/studies returns DICOM JSON array', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dicom-web/studies')
      .set('Authorization', `Bearer ${radiologistToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  itIfOrthanc('GET /api/dicom-web/studies/:uid/series -> 200', async () => {
    expect(uploadedStudyUid).toBeTruthy();

    const response = await request(app.getHttpServer())
      .get(`/api/dicom-web/studies/${uploadedStudyUid}/series`)
      .set('Authorization', `Bearer ${radiologistToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  itIfOrthanc('PATCH /api/worklist/:id/status InProgress -> 200', async () => {
    const transitioned = await request(app.getHttpServer())
      .patch(`/api/worklist/${uploadedWorklistId}/status`)
      .set('Authorization', `Bearer ${radiologistToken}`)
      .send({ status: WorklistStatus.InProgress })
      .expect(200);

    expect(transitioned.body.status).toBe(WorklistStatus.InProgress);
  });

  itIfOrthanc('PATCH /api/worklist/:id/status InProgress again -> 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/worklist/${uploadedWorklistId}/status`)
      .set('Authorization', `Bearer ${radiologistToken}`)
      .send({ status: WorklistStatus.InProgress })
      .expect(400);
  });
});
