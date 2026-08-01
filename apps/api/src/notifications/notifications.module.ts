import { Module } from '@nestjs/common';
import { SandboxSmsProvider } from './sms/sandbox-sms.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';

@Module({
  providers: [{ provide: SMS_PROVIDER, useClass: SandboxSmsProvider }],
  exports: [SMS_PROVIDER],
})
export class NotificationsModule {}
