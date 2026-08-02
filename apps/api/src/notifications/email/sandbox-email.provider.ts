import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { EmailProvider } from './email-provider.interface';

// Simulated channel: sends nothing over the network. Only ever logs the
// message -- and only in DEMO_MODE -- so a portfolio visitor can complete
// a password reset without a real inbox (CLAUDE.md §11). Outside DEMO_MODE
// this is a deliberate no-op, not a silent failure: the code is still
// generated and stored, just genuinely unreachable, exactly like
// SandboxSmsProvider until a real provider is wired in behind the same
// interface.
@Injectable()
export class SandboxEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SandboxEmailProvider.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    if (env.DEMO_MODE) {
      this.logger.log(`[DEMO] Email -> ${to} (${subject}): ${body}`);
    }
  }
}
