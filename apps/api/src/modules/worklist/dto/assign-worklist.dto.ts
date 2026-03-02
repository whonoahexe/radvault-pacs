import { IsString, MinLength } from 'class-validator';

export class AssignWorklistDto {
  @IsString()
  @MinLength(1)
  assignedTo!: string;
}
