import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, UserRole } from '@radvault/types';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './types/auth-user.type';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiry = process.env.JWT_EXPIRY ?? '15m';
  private readonly refreshTokenExpiryDays = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private normalizeIp(req: Request): string | null {
    const forwardedFor = req.header('x-forwarded-for');

    if (!forwardedFor) {
      return req.ip ?? null;
    }

    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  private getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + this.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
  }

  private async createAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      algorithm: 'RS256',
      privateKey: (process.env.JWT_SIGNING_KEY ?? '').replace(/\\n/g, '\n'),
      expiresIn: this.accessTokenExpiry,
    });
  }

  private async createTokenPair(
    user: { id: string; email: string; role: string },
    familyId: string,
  ): Promise<TokenPair & { refreshTokenHash: string; familyId: string }> {
    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    const accessToken = await this.createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      familyId,
    };
  }

  async login(body: LoginDto, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const familyId = randomUUID();
    const tokens = await this.createTokenPair(user, familyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: tokens.refreshTokenHash,
          familyId: tokens.familyId,
          expiresAt: this.getRefreshTokenExpiryDate(),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    });

    void this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        email: user.email,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string, req: Request): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!existingToken || !existingToken.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existingToken.isRevoked) {
      await this.prisma.$transaction(async (tx) => {
        await tx.refreshToken.updateMany({
          where: {
            familyId: existingToken.familyId,
            isRevoked: false,
          },
          data: {
            isRevoked: true,
          },
        });

        await this.auditService.log(
          {
            userId: existingToken.userId,
            action: AuditAction.TOKEN_REUSE_DETECTED,
            resourceType: 'User',
            resourceId: existingToken.userId,
            ipAddress: this.normalizeIp(req),
            userAgent: req.header('user-agent') ?? null,
            details: {
              familyId: existingToken.familyId,
            },
          },
          tx,
        );
      });

      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (existingToken.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: existingToken.id },
        data: { isRevoked: true },
      });

      throw new UnauthorizedException('Refresh token expired');
    }

    const nextTokens = await this.createTokenPair(existingToken.user, existingToken.familyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existingToken.id },
        data: { isRevoked: true },
      });

      await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: nextTokens.refreshTokenHash,
          familyId: existingToken.familyId,
          expiresAt: this.getRefreshTokenExpiryDate(),
        },
      });
    });

    return {
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken,
    };
  }

  async logout(refreshToken: string, userId: string, req: Request): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenHash,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });

    void this.auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      resourceType: 'User',
      resourceId: userId,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
