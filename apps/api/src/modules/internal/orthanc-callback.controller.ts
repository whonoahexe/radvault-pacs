import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole } from '@radvault/types';
import { Public } from '../auth/decorators/public.decorator';

interface OrthancJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

interface OrthancTokenValidateRequest {
  'dicom-uid': string | null;
  'orthanc-id': string | null;
  level: string | null;
  method: string;
  'token-key': string | null;
  'token-value': string | null;
  'server-id': string | null;
}

interface OrthancTokenValidateResponse {
  granted: boolean;
  validity: number;
}

interface OrthancUserProfileRequest {
  'token-key': string | null;
  'token-value': string | null;
  'server-id': string | null;
}

interface OrthancUserProfileResponse {
  name: string;
  'authorized-labels': string[];
  permissions: string[];
  validity: number;
}

@ApiTags('Internal')
@Controller('internal/orthanc')
export class OrthancCallbackController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  private deny(): OrthancTokenValidateResponse {
    return {
      granted: false,
      validity: 0,
    };
  }

  private normalizeIp(forwardedFor: string | null): string | null {
    if (!forwardedFor) {
      return null;
    }

    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  private verifyToken(token: string): Promise<OrthancJwtPayload> {
    return this.jwtService.verifyAsync<OrthancJwtPayload>(token, {
      publicKey: (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
      algorithms: ['RS256'],
    });
  }

  private permissionsForRole(role: UserRole): string[] {
    switch (role) {
      case UserRole.Admin:
        return ['all'];
      case UserRole.Technologist:
        return ['view', 'upload'];
      case UserRole.Radiologist:
        return ['view', 'report'];
      case UserRole.ReferringPhysician:
        return ['view'];
      default:
        return ['view'];
    }
  }

  @Post('tokens/validate')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Orthanc authorization plugin callback',
    description:
      'Called by Orthanc on every WADO-RS request. Validates JWT, enforces role-based access, logs audit events, and returns grant decision.',
  })
  validate(
    @Body() body: OrthancTokenValidateRequest,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
  ): Promise<OrthancTokenValidateResponse> {
    const rawToken = body['token-value'] ?? '';
    const token = rawToken.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return Promise.resolve(this.deny());
    }

    return this.verifyToken(token)
      .then((payload) => {
        if (
          payload.role === UserRole.Technologist &&
          body.method.toUpperCase() === 'GET' &&
          ['study', 'series', 'instance'].includes((body.level ?? '').toLowerCase())
        ) {
          return this.deny();
        }

        void this.auditService.log({
          userId: payload.sub,
          action: AuditAction.STUDY_VIEW,
          resourceType: 'Study',
          resourceId: body['dicom-uid'] ?? null,
          ipAddress: this.normalizeIp(forwardedFor ?? null),
        });

        return {
          granted: true,
          validity: 0,
        };
      })
      .catch(() => this.deny());
  }

  @Post('user/get-profile')
  @Public()
  @HttpCode(200)
  getProfile(@Body() body: OrthancUserProfileRequest): Promise<OrthancUserProfileResponse> {
    const rawToken = body['token-value'] ?? '';
    const token = rawToken.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return Promise.resolve({
        name: 'anonymous',
        'authorized-labels': [],
        permissions: [],
        validity: 0,
      });
    }

    return this.verifyToken(token)
      .then((payload) => ({
        name: payload.email,
        'authorized-labels': ['*'],
        permissions: this.permissionsForRole(payload.role),
        validity: 0,
      }))
      .catch(() => ({
        name: 'anonymous',
        'authorized-labels': [],
        permissions: [],
        validity: 0,
      }));
  }
}
