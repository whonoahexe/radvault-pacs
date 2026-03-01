import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorklistService } from './worklist.service';

@ApiTags('Worklist')
@Controller('api/worklist')
export class WorklistController {
  constructor(private readonly worklistService: WorklistService) {}

  // Stub — GET /api/worklist, PATCH status/assign/unclaim will be implemented in Step 2
}
