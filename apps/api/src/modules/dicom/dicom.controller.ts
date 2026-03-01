import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DicomService } from './dicom.service';

@ApiTags('DICOMweb')
@Controller('api/dicom-web')
export class DicomController {
  constructor(private readonly dicomService: DicomService) {}

  // Stub — STOW-RS, QIDO-RS endpoints will be implemented in Step 2
}
