import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WorklistPriority, WorklistStatus } from '@radvault/types';

export class WorklistQueryDto {
  @IsOptional()
  @IsEnum(WorklistStatus)
  status?: WorklistStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(WorklistPriority)
  priority?: WorklistPriority;

  @IsOptional()
  @IsString()
  modality?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
