import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditAction } from '@radvault/types';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from './types/auth-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

  private sanitizeUser<T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  async list(query: UsersQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const where = query.role ? { role: query.role } : undefined;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.sanitizeUser(row)),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async create(body: CreateUserDto, actor: AuthenticatedUser, req: Request) {
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const created = await this.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        fullName: body.fullName,
        role: body.role,
      },
    });

    void this.auditService.log({
      userId: actor.sub,
      action: AuditAction.USER_CREATE,
      resourceType: 'User',
      resourceId: created.id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        createdUserId: created.id,
        createdUserEmail: created.email,
        createdUserRole: created.role,
      },
    });

    return this.sanitizeUser(created);
  }

  async update(id: string, body: UpdateUserDto, actor: AuthenticatedUser, req: Request) {
    if (body.fullName === undefined && body.role === undefined && body.isActive === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: body.fullName,
        role: body.role,
        isActive: body.isActive,
      },
    });

    void this.auditService.log({
      userId: actor.sub,
      action: AuditAction.USER_UPDATE,
      resourceType: 'User',
      resourceId: id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        changes: {
          fullName: body.fullName,
          role: body.role,
          isActive: body.isActive,
        },
      },
    });

    return this.sanitizeUser(updated);
  }
}
