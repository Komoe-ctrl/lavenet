import { Module } from '@nestjs/common';
import { SandboxEmailProvider } from './email/sandbox-email.provider';
import { EMAIL_PROVIDER } from './email/email-provider.interface';
import { SandboxSmsProvider } from './sms/sandbox-sms.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';

@Module({
  providers: [
    { provide: SMS_PROVIDER, useClass: SandboxSmsProvider },
    { provide: EMAIL_PROVIDER, useClass: SandboxEmailProvider },
  ],
  exports: [SMS_PROVIDER, EMAIL_PROVIDER],
})
export class NotificationsModule {}
