import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorklistStatus } from '@prisma/client';
import { AuditAction, UserRole } from '@radvault/types';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/auth-user.type';
import { WorklistQueryDto } from './dto/worklist-query.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

interface TransitionOptions {
  req?: Request;
  actorRole?: UserRole;
  source?: 'controller' | 'report';
  executor?: PrismaExecutor;
}

@Injectable()
export class WorklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly allowedTransitions: Record<WorklistStatus, WorklistStatus[]> = {
    Scheduled: [WorklistStatus.InProgress],
    InProgress: [WorklistStatus.Scheduled, WorklistStatus.Preliminary],
    Preliminary: [WorklistStatus.Final],
    Final: [WorklistStatus.Amended],
    Amended: [],
  };

  private normalizeIp(req?: Request): string | null {
    if (!req) {
      return null;
    }

    const forwardedFor = req.header('x-forwarded-for');
    if (!forwardedFor) {
      return req.ip ?? null;
    }

    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  rejectUnsupportedControllerTransition(): never {
    throw new BadRequestException('This status transition is only allowed via report workflow');
  }

  async getWorklist(query: WorklistQueryDto) {
    const where: Prisma.WorklistItemWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.assignedTo) {
      where.assignedTo = query.assignedTo;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.modality) {
      where.study = {
        modalitiesInStudy: {
          contains: query.modality,
          mode: 'insensitive',
        },
      };
    }

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const rows = await this.prisma.worklistItem.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
        study: {
          include: {
            patient: true,
          },
        },
      },
    });

    const priorityRank: Record<string, number> = {
      Stat: 3,
      Urgent: 2,
      Routine: 1,
    };

    const sorted = rows.sort((left, right) => {
      const priorityDelta =
        (priorityRank[right.priority] ?? 0) - (priorityRank[left.priority] ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftScheduled = left.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightScheduled = right.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftScheduled - rightScheduled;
    });

    return {
      data: sorted.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: sorted.length,
      },
    };
  }

  async getWorklistItem(id: string) {
    const item = await this.prisma.worklistItem.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
        study: {
          include: {
            patient: true,
            series: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Worklist item not found');
    }

    return item;
  }

  async transition(
    id: string,
    newStatus: WorklistStatus,
    userId: string,
    options?: TransitionOptions,
  ) {
    const executor = options?.executor ?? this.prisma;

    const item = await executor.worklistItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Worklist item not found');
    }

    if (options?.source === 'controller') {
      if (
        newStatus === WorklistStatus.Preliminary ||
        newStatus === WorklistStatus.Final ||
        newStatus === WorklistStatus.Amended
      ) {
        throw new BadRequestException('This status transition is only allowed via report workflow');
      }
    }

    const allowed = this.allowedTransitions[item.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Invalid transition: ${item.status} -> ${newStatus}`);
    }

    const data: Prisma.WorklistItemUncheckedUpdateInput = {
      status: newStatus,
    };

    if (item.status === WorklistStatus.Scheduled && newStatus === WorklistStatus.InProgress) {
      data.assignedTo = userId;
      data.startedAt = new Date();
    }

    if (item.status === WorklistStatus.InProgress && newStatus === WorklistStatus.Scheduled) {
      data.assignedTo = null;
      data.startedAt = null;
    }

    if (newStatus === WorklistStatus.Final || newStatus === WorklistStatus.Amended) {
      data.completedAt = new Date();
    }

    const updated = await executor.worklistItem.update({
      where: { id },
      data,
    });

    if (options?.source === 'controller') {
      const action =
        newStatus === WorklistStatus.InProgress
          ? AuditAction.WORKLIST_CLAIM
          : AuditAction.WORKLIST_UNCLAIM;

      void this.auditService.log(
        {
          userId,
          action,
          resourceType: 'WorklistItem',
          resourceId: id,
          ipAddress: this.normalizeIp(options.req),
          userAgent: options.req?.header('user-agent') ?? null,
          details: {
            from: item.status,
            to: newStatus,
          },
        },
        options.executor,
      );
    }

    return updated;
  }

  async assign(id: string, assignedTo: string, actorId: string, req: Request) {
    const item = await this.prisma.worklistItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Worklist item not found');
    }

    const updated = await this.prisma.worklistItem.update({
      where: { id },
      data: {
        assignedTo,
      },
    });

    void this.auditService.log({
      userId: actorId,
      action: AuditAction.WORKLIST_ASSIGN,
      resourceType: 'WorklistItem',
      resourceId: id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        assignedTo,
      },
    });

    return updated;
  }

  async unclaim(id: string, user: AuthenticatedUser, req: Request) {
    const item = await this.prisma.worklistItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Worklist item not found');
    }

    if (user.role === UserRole.Radiologist && item.assignedTo !== user.sub) {
      throw new ForbiddenException('Only assigned radiologist can unclaim this worklist item');
    }

    return this.transition(id, WorklistStatus.Scheduled, user.sub, {
      req,
      actorRole: user.role,
      source: 'controller',
    });
  }
}
