import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditAction } from '@radvault/types';

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
