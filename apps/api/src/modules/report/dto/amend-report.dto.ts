import { IsOptional, IsString } from 'class-validator';

export class AmendReportDto {
  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  @IsString()
  impression?: string;
}
