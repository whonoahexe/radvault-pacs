import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus as PrismaReportStatus, WorklistStatus } from '@prisma/client';
import { AuditAction, ReportStatus, UserRole } from '@radvault/types';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorklistService } from '../worklist/worklist.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { SignReportDto } from './dto/sign-report.dto';
import { AmendReportDto } from './dto/amend-report.dto';
import type { AuthenticatedUser } from '../auth/types/auth-user.type';

const WORKLIST_STATUS_BY_REPORT_STATUS: Record<
  ReportStatus.Preliminary | ReportStatus.Final | ReportStatus.Amended,
  WorklistStatus
> = {
  [ReportStatus.Preliminary]: WorklistStatus.Preliminary,
  [ReportStatus.Final]: WorklistStatus.Final,
  [ReportStatus.Amended]: WorklistStatus.Amended,
};

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly worklistService: WorklistService,
  ) {}

  private normalizeIp(req: Request): string | null {
    const forwardedFor = req.header('x-forwarded-for');
    if (!forwardedFor) {
      return req.ip ?? null;
    }

    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  private ensureReferringScope(
    user: AuthenticatedUser,
    referringPhysicianName: string | null,
  ): void {
    if (user.role === UserRole.ReferringPhysician && referringPhysicianName !== user.fullName) {
      throw new NotFoundException('Report not found');
    }
  }

  async create(body: CreateReportDto, user: AuthenticatedUser, req: Request) {
    const study = await this.prisma.study.findUnique({
      where: { id: body.studyId },
      select: { id: true },
    });

    if (!study) {
      throw new NotFoundException('Study not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          studyId: body.studyId,
          authorId: user.sub,
          status: PrismaReportStatus.Draft,
          indication: body.indication ?? null,
          technique: body.technique ?? null,
          comparison: body.comparison ?? null,
          findings: body.findings ?? null,
          impression: body.impression ?? null,
          version: 1,
        },
      });

      await tx.reportVersion.create({
        data: {
          reportId: report.id,
          versionNumber: 1,
          indication: report.indication,
          technique: report.technique,
          comparison: report.comparison,
          findings: report.findings,
          impression: report.impression,
          authorId: user.sub,
          statusAtVersion: ReportStatus.Draft,
        },
      });

      await this.auditService.log(
        {
          userId: user.sub,
          action: AuditAction.REPORT_CREATE,
          resourceType: 'Report',
          resourceId: report.id,
          ipAddress: this.normalizeIp(req),
          userAgent: req.header('user-agent') ?? null,
          details: {
            studyId: report.studyId,
          },
        },
        tx,
      );

      return report;
    });
  }

  async update(id: string, body: UpdateReportDto, user: AuthenticatedUser, req: Request) {
    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    if (existing.authorId !== user.sub) {
      throw new ForbiddenException('Only report author can update this report');
    }

    if (existing.status !== PrismaReportStatus.Draft) {
      throw new BadRequestException('Only Draft reports can be updated');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: {
          indication: body.indication ?? existing.indication,
          technique: body.technique ?? existing.technique,
          comparison: body.comparison ?? existing.comparison,
          findings: body.findings ?? existing.findings,
          impression: body.impression ?? existing.impression,
          version: { increment: 1 },
        },
      });

      await tx.reportVersion.create({
        data: {
          reportId: updated.id,
          versionNumber: updated.version,
          indication: updated.indication,
          technique: updated.technique,
          comparison: updated.comparison,
          findings: updated.findings,
          impression: updated.impression,
          authorId: user.sub,
          statusAtVersion: updated.status,
        },
      });

      await this.auditService.log(
        {
          userId: user.sub,
          action: AuditAction.REPORT_UPDATE,
          resourceType: 'Report',
          resourceId: updated.id,
          ipAddress: this.normalizeIp(req),
          userAgent: req.header('user-agent') ?? null,
          details: {
            version: updated.version,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async sign(id: string, body: SignReportDto, user: AuthenticatedUser, req: Request) {
    if (body.status !== ReportStatus.Preliminary && body.status !== ReportStatus.Final) {
      throw new BadRequestException('Sign status must be Preliminary or Final');
    }

    const existing = await this.prisma.report.findUnique({
      where: { id },
      include: {
        study: {
          select: {
            worklistItem: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    if (body.status === ReportStatus.Preliminary) {
      if (
        existing.status !== PrismaReportStatus.Draft &&
        existing.status !== PrismaReportStatus.Preliminary
      ) {
        throw new BadRequestException('Preliminary sign is only allowed from Draft or Preliminary');
      }
    }

    if (body.status === ReportStatus.Final && existing.status !== PrismaReportStatus.Preliminary) {
      throw new BadRequestException('Final sign is only allowed from Preliminary');
    }

    const worklistId = existing.study.worklistItem?.id;
    if (!worklistId) {
      throw new BadRequestException('Worklist item not found for report study');
    }

    const auditAction =
      body.status === ReportStatus.Preliminary
        ? AuditAction.REPORT_SIGN_PRELIMINARY
        : AuditAction.REPORT_SIGN_FINAL;

    return this.prisma.$transaction(async (tx) => {
      const signed = await tx.report.update({
        where: { id },
        data: {
          status: body.status,
          signedBy: user.sub,
          signedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await tx.reportVersion.create({
        data: {
          reportId: signed.id,
          versionNumber: signed.version,
          indication: signed.indication,
          technique: signed.technique,
          comparison: signed.comparison,
          findings: signed.findings,
          impression: signed.impression,
          authorId: user.sub,
          statusAtVersion: signed.status,
        },
      });

      await this.auditService.log(
        {
          userId: user.sub,
          action: auditAction,
          resourceType: 'Report',
          resourceId: signed.id,
          ipAddress: this.normalizeIp(req),
          userAgent: req.header('user-agent') ?? null,
          details: {
            status: body.status,
          },
        },
        tx,
      );

      await this.worklistService.transition(
        worklistId,
        WORKLIST_STATUS_BY_REPORT_STATUS[body.status],
        user.sub,
        {
          source: 'report',
          executor: tx,
        },
      );

      return signed;
    });
  }

  async amend(id: string, body: AmendReportDto, user: AuthenticatedUser, req: Request) {
    const existing = await this.prisma.report.findUnique({
      where: { id },
      include: {
        study: {
          select: {
            worklistItem: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    if (existing.status !== PrismaReportStatus.Final) {
      throw new BadRequestException('Only Final reports can be amended');
    }

    const worklistId = existing.study.worklistItem?.id;
    if (!worklistId) {
      throw new BadRequestException('Worklist item not found for report study');
    }

    return this.prisma.$transaction(async (tx) => {
      const amended = await tx.report.create({
        data: {
          studyId: existing.studyId,
          authorId: user.sub,
          status: PrismaReportStatus.Amended,
          indication: existing.indication,
          technique: existing.technique,
          comparison: existing.comparison,
          findings: body.findings ?? existing.findings,
          impression: body.impression ?? existing.impression,
          version: 1,
          signedBy: user.sub,
          signedAt: new Date(),
        },
      });

      await tx.reportVersion.create({
        data: {
          reportId: amended.id,
          versionNumber: 1,
          indication: amended.indication,
          technique: amended.technique,
          comparison: amended.comparison,
          findings: amended.findings,
          impression: amended.impression,
          authorId: user.sub,
          statusAtVersion: ReportStatus.Amended,
        },
      });

      await this.auditService.log(
        {
          userId: user.sub,
          action: AuditAction.REPORT_AMEND,
          resourceType: 'Report',
          resourceId: amended.id,
          ipAddress: this.normalizeIp(req),
          userAgent: req.header('user-agent') ?? null,
          details: {
            originalReportId: existing.id,
          },
        },
        tx,
      );

      await this.worklistService.transition(worklistId, WorklistStatus.Amended, user.sub, {
        source: 'report',
        executor: tx,
      });

      return amended;
    });
  }

  async list(studyId: string, user: AuthenticatedUser, req: Request) {
    const where: Prisma.ReportWhereInput = {};
    if (studyId) {
      where.studyId = studyId;
    }

    if (user.role === UserRole.ReferringPhysician) {
      where.study = {
        referringPhysicianName: user.fullName,
      };
    }

    const reports = await this.prisma.report.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
          },
        },
        study: {
          select: {
            id: true,
            studyInstanceUid: true,
            referringPhysicianName: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    void this.auditService.log({
      userId: user.sub,
      action: AuditAction.STUDY_VIEW,
      resourceType: 'Report',
      resourceId: null,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        studyId,
      },
    });

    return reports;
  }

  async getById(id: string, user: AuthenticatedUser, req: Request) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        study: {
          select: {
            id: true,
            referringPhysicianName: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'asc' },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    this.ensureReferringScope(user, report.study.referringPhysicianName);

    void this.auditService.log({
      userId: user.sub,
      action: AuditAction.STUDY_VIEW,
      resourceType: 'Report',
      resourceId: report.id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return report;
  }
}
