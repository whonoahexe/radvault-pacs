import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '@radvault/types';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
