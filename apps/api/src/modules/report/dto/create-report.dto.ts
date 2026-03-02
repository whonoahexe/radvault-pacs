import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  studyId!: string;

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
