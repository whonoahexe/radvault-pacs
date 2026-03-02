import { UserRole } from '@radvault/types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser extends JwtPayload {
  fullName: string;
}
