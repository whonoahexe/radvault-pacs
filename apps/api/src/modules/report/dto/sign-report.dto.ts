import { IsEnum } from 'class-validator';
import { ReportStatus } from '@radvault/types';

export class SignReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus.Preliminary | ReportStatus.Final;
}
