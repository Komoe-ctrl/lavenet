import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  // No global secret/expiry here: AuthService passes them explicitly per
  // sign()/verify() call, sourced from the zod-validated `env` — one place
  // for config, not duplicated into JwtModule.register().
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
