import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n');
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      global: true,
      privateKey: normalizePem(process.env.JWT_PRIVATE_KEY ?? ''),
      publicKey: normalizePem(process.env.JWT_PUBLIC_KEY ?? ''),
      signOptions: {
        algorithm: 'RS256',
        expiresIn: process.env.JWT_EXPIRY ?? '15m',
      },
      verifyOptions: {
        algorithms: ['RS256'],
      },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
