import { IsEnum } from 'class-validator';
import { WorklistStatus } from '@radvault/types';

export class TransitionWorklistDto {
  @IsEnum(WorklistStatus)
  status!: WorklistStatus;
}
