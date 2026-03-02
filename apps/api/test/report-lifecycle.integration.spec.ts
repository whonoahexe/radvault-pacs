import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  PrismaClient,
  ReportStatus,
  UserRole,
  WorklistPriority,
  WorklistStatus,
} from '@prisma/client';
import { bootstrapIntegrationApp } from './test-app';

describe('@group integration Report lifecycle API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let usersByRole: Awaited<ReturnType<typeof bootstrapIntegrationApp>>['usersByRole'];
  let accessToken = '';
  let reportId = '';
  let studyId = '';

  beforeAll(async () => {
    const bootstrap = await bootstrapIntegrationApp();
    app = bootstrap.app;
    prisma = bootstrap.prisma;
    usersByRole = bootstrap.usersByRole;

    const radiologist = await prisma.user.findUniqueOrThrow({
      where: { email: usersByRole.radiologist.email },
    });

    const patient = await prisma.patient.create({
      data: {
        patientId: `P-${Date.now()}`,
        patientName: 'Report Lifecycle Patient',
      },
    });

    const study = await prisma.study.create({
      data: {
        patientId: patient.id,
        studyInstanceUid: `1.2.840.113619.${Date.now()}`,
        studyDescription: 'Lifecycle Study',
        referringPhysicianName: usersByRole.referringPhysician.fullName,
      },
    });
    studyId = study.id;

    await prisma.worklistItem.create({
      data: {
        studyId: study.id,
        assignedTo: radiologist.id,
        status: WorklistStatus.InProgress,
        priority: WorklistPriority.Routine,
        scheduledAt: new Date(),
        startedAt: new Date(),
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: usersByRole.radiologist.email,
        password: usersByRole.radiologist.password,
      })
      .expect(200);

    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /api/reports -> 201 creates Draft report', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        studyId,
        findings: 'Initial findings',
        impression: 'Initial impression',
      })
      .expect(201);

    reportId = response.body.id;
    expect(response.body.status).toBe(ReportStatus.Draft);
    expect(response.body.version).toBe(1);
  });

  it('PUT /api/reports/:id -> 200 updates content and increments version', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        findings: 'Updated findings',
        impression: 'Updated impression',
      })
      .expect(200);

    expect(response.body.findings).toBe('Updated findings');
    expect(response.body.version).toBe(2);
  });

  it('POST /api/reports/:id/sign { Preliminary } -> transitions to Preliminary', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/sign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: ReportStatus.Preliminary })
      .expect(201);

    expect(response.body.status).toBe(ReportStatus.Preliminary);
  });

  it('POST /api/reports/:id/sign { Final } -> transitions to Final and locks report', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/sign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: ReportStatus.Final })
      .expect(201);

    expect(response.body.status).toBe(ReportStatus.Final);
    expect(response.body.signedAt).toBeTruthy();
    expect(response.body.signedBy).toBeTruthy();
  });

  it('PUT /api/reports/:id after Final -> 400', async () => {
    await request(app.getHttpServer())
      .put(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ findings: 'should fail' })
      .expect(400);
  });

  it('POST /api/reports/:id/amend -> creates new report record', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/amend`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ findings: 'Amended findings', impression: 'Amended impression' })
      .expect(201);

    expect(response.body.id).not.toBe(reportId);
    expect(response.body.status).toBe(ReportStatus.Amended);
  });

  it('GET /api/reports?studyId=... returns both original and amended', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/reports?studyId=${encodeURIComponent(studyId)}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body).toHaveLength(2);
    const statuses = list.body.map((item: { status: string }) => item.status).sort();
    expect(statuses).toEqual([ReportStatus.Amended, ReportStatus.Final].sort());
  });
});
