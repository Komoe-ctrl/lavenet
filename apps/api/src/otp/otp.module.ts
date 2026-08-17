import { Module } from '@nestjs/common';
import { OtpRepository } from './otp.repository';
import { OtpService } from './otp.service';

@Module({
  providers: [OtpService, OtpRepository],
  exports: [OtpService],
})
export class OtpModule {}
