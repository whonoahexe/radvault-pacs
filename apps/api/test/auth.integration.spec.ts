import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootstrapIntegrationApp } from './test-app';

describe('@group integration Auth API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let usersByRole: Awaited<ReturnType<typeof bootstrapIntegrationApp>>['usersByRole'];

  beforeAll(async () => {
    const bootstrap = await bootstrapIntegrationApp();
    app = bootstrap.app;
    prisma = bootstrap.prisma;
    usersByRole = bootstrap.usersByRole;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /api/auth/login with valid credentials -> 200 and returns tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: usersByRole.radiologist.email,
        password: usersByRole.radiologist.password,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(usersByRole.radiologist.email);
  });

  it('POST /api/auth/login with wrong password -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: usersByRole.radiologist.email,
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('POST /api/auth/login with unknown email -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'unknown@radvault.local',
        password: 'unknown',
      })
      .expect(401);
  });

  it('GET /api/auth/me with valid Bearer token -> 200', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: usersByRole.radiologist.email,
        password: usersByRole.radiologist.password,
      })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body.email).toBe(usersByRole.radiologist.email);
    expect(me.body.role).toBe('Radiologist');
  });

  it('GET /api/auth/me without token -> 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('POST /api/auth/refresh with valid token -> 200 and returns new tokens', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: usersByRole.radiologist.email,
        password: usersByRole.radiologist.password,
      })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it('POST /api/auth/refresh with invalid token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' })
      .expect(401);
  });
});
