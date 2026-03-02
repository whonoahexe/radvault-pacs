import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const req = {
    header: jest.fn().mockReturnValue(null),
    ip: '127.0.0.1',
  } as unknown as Request;

  const service = new AuthService(prisma, jwtService, auditService as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: any) => unknown) =>
      callback({
        refreshToken: prisma.refreshToken,
        user: prisma.user,
      }),
    );
    (jwtService.signAsync as jest.Mock).mockResolvedValue('access-token');
  });

  it('login() with valid credentials returns accessToken + refreshToken + user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'rad@radvault.local',
      passwordHash: 'hashed',
      fullName: 'Dr. Test',
      role: 'Radiologist',
      isActive: true,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login(
      {
        email: 'rad@radvault.local',
        password: 'secret',
      },
      req,
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe('rad@radvault.local');
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('login() with wrong password throws UnauthorizedException', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'rad@radvault.local',
      passwordHash: 'hashed',
      fullName: 'Dr. Test',
      role: 'Radiologist',
      isActive: true,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login(
        {
          email: 'rad@radvault.local',
          password: 'wrong',
        },
        req,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login() with inactive user throws UnauthorizedException', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'rad@radvault.local',
      passwordHash: 'hashed',
      fullName: 'Dr. Test',
      role: 'Radiologist',
      isActive: false,
    });

    await expect(
      service.login(
        {
          email: 'rad@radvault.local',
          password: 'secret',
        },
        req,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login() with unknown email throws UnauthorizedException', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login(
        {
          email: 'unknown@radvault.local',
          password: 'secret',
        },
        req,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh() with valid token returns new token pair', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'family-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'rad@radvault.local',
        role: 'Radiologist',
        isActive: true,
      },
    });

    const result = await service.refresh('refresh-token', req);

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('refresh() with unknown token throws UnauthorizedException', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(service.refresh('missing-token', req)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh() with inactive user throws UnauthorizedException', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'family-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'rad@radvault.local',
        role: 'Radiologist',
        isActive: false,
      },
    });

    await expect(service.refresh('inactive-user-token', req)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh() with revoked token revokes entire family and throws UnauthorizedException', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'family-1',
      isRevoked: true,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'rad@radvault.local',
        role: 'Radiologist',
        isActive: true,
      },
    });

    await expect(service.refresh('refresh-token', req)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        familyId: 'family-1',
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });
  });

  it('refresh() with expired token throws UnauthorizedException', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'family-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() - 60_000),
      user: {
        id: 'user-1',
        email: 'rad@radvault.local',
        role: 'Radiologist',
        isActive: true,
      },
    });

    await expect(service.refresh('refresh-token', req)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { isRevoked: true },
    });
  });

  it('logout() marks token as revoked', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await service.logout('refresh-token', 'user-1', req);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        tokenHash: expect.any(String),
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });
  });

  it('me() returns active user profile', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'rad@radvault.local',
      fullName: 'Dr. Test',
      role: 'Radiologist',
      isActive: true,
    });

    const profile = await service.me('user-1');
    expect(profile.email).toBe('rad@radvault.local');
  });

  it('me() rejects for inactive user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'rad@radvault.local',
      fullName: 'Dr. Test',
      role: 'Radiologist',
      isActive: false,
    });

    await expect(service.me('user-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
