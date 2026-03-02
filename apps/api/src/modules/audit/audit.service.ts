import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditAction } from '@radvault/types';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export interface AuditLogInput {
  userId?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Prisma.InputJsonValue | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  log(input: AuditLogInput, executor?: PrismaExecutor): Promise<void> {
    const prismaExecutor = executor ?? this.prisma;

    return prismaExecutor.auditLog
      .create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          details: input.details ?? Prisma.JsonNull,
        },
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error(
          'Failed to write audit log',
          error instanceof Error ? error.stack : undefined,
        );
      });
  }
}
