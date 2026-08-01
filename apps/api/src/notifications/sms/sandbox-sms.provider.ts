import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { SmsProvider } from './sms-provider.interface';

// Simulated channel: sends nothing over the network. Only ever logs the
// message -- and only in DEMO_MODE -- so a portfolio visitor can complete
// the OTP flow without a real phone number or SMS budget (CLAUDE.md §11).
// Outside DEMO_MODE this is a deliberate no-op, not a silent failure: the
// code is still generated and stored, just genuinely unreachable, which is
// correct until a real provider is wired in behind the same interface.
@Injectable()
export class SandboxSmsProvider implements SmsProvider {
  private readonly logger = new Logger(SandboxSmsProvider.name);

  async send(phone: string, message: string): Promise<void> {
    if (env.DEMO_MODE) {
      this.logger.log(`[DEMO] SMS -> ${phone}: ${message}`);
    }
  }
}
