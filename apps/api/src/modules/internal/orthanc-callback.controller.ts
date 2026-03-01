import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

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

@ApiTags('Internal')
@Controller('internal/orthanc')
export class OrthancCallbackController {
  @Post('tokens/validate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Orthanc authorization plugin callback',
    description:
      'Called by Orthanc on every WADO-RS request. Validates JWT and returns grant decision. Currently returns granted: true unconditionally (stub).',
  })
  validate(
    @Body() _body: OrthancTokenValidateRequest,
  ): OrthancTokenValidateResponse {
    // Stub — always grant access. Real JWT validation + audit logging in Step 2.
    // The plugin sends token-value in the body, NOT as a header.
    // Response must always be HTTP 200 with granted: true/false.
    // Never return HTTP 403 — Orthanc handles that based on granted: false.
    // validity: 0 disables response caching so every request is audited.
    return {
      granted: true,
      validity: 0,
    };
  }
}
