import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service';

@ApiTags('Reports')
@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // Stub — CRUD, sign, amend endpoints will be implemented in Step 2
}
