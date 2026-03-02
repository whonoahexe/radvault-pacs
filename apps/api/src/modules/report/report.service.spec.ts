import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportStatus as PrismaReportStatus, WorklistStatus } from '@prisma/client';
import { ReportStatus, UserRole } from '@radvault/types';
import type { Request } from 'express';
import { ReportService } from './report.service';

describe('ReportService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const worklistService = {
    transition: jest.fn().mockResolvedValue(undefined),
  };

  const tx = {
    report: {
      create: jest.fn(),
      update: jest.fn(),
    },
    reportVersion: {
      create: jest.fn(),
    },
  } as any;

  const prisma = {
    study: {
      findUnique: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
  } as any;

  const service = new ReportService(prisma, auditService as any, worklistService as any);
  const user = {
    sub: 'rad-1',
    email: 'rad@radvault.local',
    fullName: 'Dr. Test',
    role: 'Radiologist',
  } as any;
  const req = {
    header: jest.fn().mockReturnValue(null),
    ip: '127.0.0.1',
  } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create() inserts report + report_version + audit in transaction', async () => {
    prisma.study.findUnique.mockResolvedValue({ id: 'study-1' });
    tx.report.create.mockResolvedValue({
      id: 'report-1',
      studyId: 'study-1',
      indication: 'indication',
      technique: null,
      comparison: null,
      findings: 'findings',
      impression: 'impression',
    });

    await service.create(
      {
        studyId: 'study-1',
        indication: 'indication',
        findings: 'findings',
        impression: 'impression',
      },
      user,
      req,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.report.create).toHaveBeenCalledTimes(1);
    expect(tx.reportVersion.create).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPORT_CREATE' }), tx);
  });

  it('create() rejects when study does not exist', async () => {
    prisma.study.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          studyId: 'missing',
        },
        user,
        req,
      ),
    ).rejects.toThrow('Study not found');
  });

  it('update() rejects if status !== Draft', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      authorId: user.sub,
      status: PrismaReportStatus.Final,
    });

    await expect(service.update('report-1', { findings: 'updated' }, user, req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update() rejects if authorId !== user.sub', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      authorId: 'other-user',
      status: PrismaReportStatus.Draft,
    });

    await expect(service.update('report-1', { findings: 'updated' }, user, req)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('update() succeeds from Draft and records new version', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      authorId: user.sub,
      status: PrismaReportStatus.Draft,
      indication: null,
      technique: null,
      comparison: null,
      findings: 'old findings',
      impression: 'old impression',
    });
    tx.report.update.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Draft,
      version: 2,
      indication: null,
      technique: null,
      comparison: null,
      findings: 'new findings',
      impression: 'new impression',
    });

    const updated = await service.update(
      'report-1',
      {
        findings: 'new findings',
        impression: 'new impression',
      },
      user,
      req,
    );

    expect(updated.version).toBe(2);
    expect(tx.reportVersion.create).toHaveBeenCalled();
  });

  it('sign() Preliminary is allowed from Draft and syncs worklist to Preliminary', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Draft,
      study: {
        worklistItem: {
          id: 'wl-1',
        },
      },
    });

    tx.report.update.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Preliminary,
      signedBy: user.sub,
      signedAt: new Date(),
      version: 2,
      indication: null,
      technique: null,
      comparison: null,
      findings: 'f',
      impression: 'i',
    });

    const result = await service.sign('report-1', { status: ReportStatus.Preliminary }, user, req);

    expect(result.status).toBe(PrismaReportStatus.Preliminary);
    expect(result.signedBy).toBe(user.sub);
    expect(result.signedAt).toBeInstanceOf(Date);
    expect(worklistService.transition).toHaveBeenCalledWith(
      'wl-1',
      WorklistStatus.Preliminary,
      user.sub,
      expect.objectContaining({ source: 'report', executor: tx }),
    );
  });

  it('sign() Final is allowed from Preliminary only', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Preliminary,
      study: {
        worklistItem: {
          id: 'wl-1',
        },
      },
    });

    tx.report.update.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Final,
      signedBy: user.sub,
      signedAt: new Date(),
      version: 3,
      indication: null,
      technique: null,
      comparison: null,
      findings: 'f',
      impression: 'i',
    });

    const result = await service.sign('report-1', { status: ReportStatus.Final }, user, req);

    expect(result.status).toBe(PrismaReportStatus.Final);
    expect(worklistService.transition).toHaveBeenCalledWith(
      'wl-1',
      WorklistStatus.Final,
      user.sub,
      expect.objectContaining({ source: 'report', executor: tx }),
    );
  });

  it('sign() Final rejects from Draft', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Draft,
      study: {
        worklistItem: {
          id: 'wl-1',
        },
      },
    });

    await expect(service.sign('report-1', { status: ReportStatus.Final }, user, req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sign() rejects unsupported sign status', async () => {
    await expect(
      service.sign('report-1', { status: ReportStatus.Amended as ReportStatus.Preliminary }, user, req),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sign() rejects when worklist item is not present for study', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Draft,
      study: {
        worklistItem: null,
      },
    });

    await expect(
      service.sign('report-1', { status: ReportStatus.Preliminary }, user, req),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('amend() rejects if status !== Final', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      status: PrismaReportStatus.Preliminary,
      study: {
        worklistItem: {
          id: 'wl-1',
        },
      },
    });

    await expect(service.amend('report-1', { findings: 'amended' }, user, req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('amend() creates new report record and does not mutate original', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      studyId: 'study-1',
      authorId: user.sub,
      status: PrismaReportStatus.Final,
      indication: 'indication',
      technique: 'technique',
      comparison: 'comparison',
      findings: 'old findings',
      impression: 'old impression',
      study: {
        worklistItem: {
          id: 'wl-1',
        },
      },
    });

    tx.report.create.mockResolvedValue({
      id: 'report-2',
      studyId: 'study-1',
      status: PrismaReportStatus.Amended,
      findings: 'new findings',
      impression: 'new impression',
      version: 1,
      indication: 'indication',
      technique: 'technique',
      comparison: 'comparison',
    });

    const amended = await service.amend(
      'report-1',
      {
        findings: 'new findings',
        impression: 'new impression',
      },
      user,
      req,
    );

    expect(amended.id).toBe('report-2');
    expect(tx.report.update).not.toHaveBeenCalled();
    expect(worklistService.transition).toHaveBeenCalledWith(
      'wl-1',
      WorklistStatus.Amended,
      user.sub,
      expect.objectContaining({ source: 'report', executor: tx }),
    );
  });

  it('list() applies referring physician scope', async () => {
    prisma.report.findMany = jest.fn().mockResolvedValue([{ id: 'report-1' }]);

    const reports = await service.list(
      'study-1',
      {
        sub: 'ref-1',
        role: UserRole.ReferringPhysician,
        fullName: 'Dr. Referrer',
      } as any,
      req,
    );

    expect(reports).toHaveLength(1);
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          study: {
            referringPhysicianName: 'Dr. Referrer',
          },
        }),
      }),
    );
  });

  it('getById() enforces referring physician scope', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'report-1',
      study: {
        id: 'study-1',
        referringPhysicianName: 'Dr. Other',
      },
      versions: [],
    });

    await expect(
      service.getById(
        'report-1',
        {
          sub: 'ref-1',
          role: UserRole.ReferringPhysician,
          fullName: 'Dr. Referrer',
        } as any,
        req,
      ),
    ).rejects.toThrow('Report not found');
  });
});
