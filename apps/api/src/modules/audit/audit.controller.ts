import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('api/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // Stub — GET /api/audit-logs will be implemented in Step 2
}
