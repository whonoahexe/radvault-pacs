import { IsOptional, IsString } from 'class-validator';

export class UpdateReportDto {
  @IsOptional()
  @IsString()
  indication?: string;

  @IsOptional()
  @IsString()
  technique?: string;

  @IsOptional()
  @IsString()
  comparison?: string;

  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  @IsString()
  impression?: string;
}
