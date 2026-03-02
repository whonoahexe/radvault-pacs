import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@radvault/types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
